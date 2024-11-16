const express = require('express');
const nacl = require('tweetnacl');
const router = express.Router();
const app = express();
const dotenv = require('dotenv').config();
const admin = require("firebase-admin");
const axios = require("axios");
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
const mongoose = require('mongoose');
const { Allstaff, Bank, Inflow } = require("./Model/staffmodel");
const ObjectId = mongoose.Types.ObjectId; 


const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  const db = admin.firestore();





// In-memory tracking of trade hashes..
// First list (temporary check for trades that are about to be assigned)
const assignedTradeHashes = new Set();
const strictAssignedTradeHashes = new Set();

const assignTradeToStaff = async (tradePayload) => {
  try {
    // First list check to avoid duplicate trade assignments
    if (assignedTradeHashes.has(tradePayload.trade_hash)) {
      console.log(`Trade ${tradePayload.trade_hash} is already being processed.`);
      console.log(`Waiting 3 seconds before adding trade ${tradePayload.trade_hash} to the strict check list.`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      strictAssignedTradeHashes.add(tradePayload.trade_hash);
      console.log(`Trade ${tradePayload.trade_hash} added to the strict check list.`);
    } else {
      console.log(`Adding trade ${tradePayload.trade_hash} to the first check list.`);
      assignedTradeHashes.add(tradePayload.trade_hash);
    }

    // Strict duplicate check before processing
    if (strictAssignedTradeHashes.has(tradePayload.trade_hash)) {
      console.log(`Trade ${tradePayload.trade_hash} already assigned or processed. Skipping assignment.`);
      return;
    }

    // Retrieve eligible staff from Firestore
    const staffSnapshot = await db.collection('Allstaff').get();
    let eligibleStaff = [];

    staffSnapshot.docs.forEach(doc => {
      const staffData = doc.data();
      const hasPendingTrades = staffData.assignedTrades.some(trade => !trade.isPaid);

      if (!hasPendingTrades && staffData.clockedIn) {
        eligibleStaff.push(doc);
      }

      // Check for existing trade_hash
      if (staffData.assignedTrades.some(trade => trade.trade_hash === tradePayload.trade_hash)) {
        console.log(`Trade ${tradePayload.trade_hash} already exists for staff: ${staffData.name}.`);
        strictAssignedTradeHashes.add(tradePayload.trade_hash);
        console.log(`Duplicate trade detected. Skipping assignment for ${tradePayload.trade_hash}.`);
      }
    });

    if (eligibleStaff.length === 0) {
      console.log('No eligible staff found. Saving trade to manual unassigned collection.');
      await db.collection('manualunassigned').add({
        trade_hash: tradePayload.trade_hash,
        fiat_amount_requested: tradePayload.fiat_amount_requested,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Select staff with the least trades
    let staffWithLeastTrades = eligibleStaff[0];
    eligibleStaff.forEach(doc => {
      if (doc.data().assignedTrades.length < staffWithLeastTrades.data().assignedTrades.length) {
        staffWithLeastTrades = doc;
      }
    });

    const assignedStaffId = staffWithLeastTrades.id;
    const staffRef = db.collection('Allstaff').doc(assignedStaffId);
    const assignedAt = new Date();

    const tradeData = {
      trade_hash: tradePayload.trade_hash,
      fiat_amount_requested: tradePayload.fiat_amount_requested,
      assignedAt: assignedAt,
      handle: tradePayload.buyer_name,
      account: "Noones",
      isPaid: false,
      seller_name: tradePayload.seller_name,
      analytics: tradePayload,
    };

    // Update Firestore
    await staffRef.update({
      assignedTrades: admin.firestore.FieldValue.arrayUnion(tradeData),
    });

    // Synchronize with MongoDB
    const staffData = staffWithLeastTrades.data();
    const mongoUpdate = await Allstaff.findOneAndUpdate(
      { username: staffData.username }, // Match by username
      { $push: { assignedTrades: tradeData } }, // Add the trade data to assignedTrades
      { new: true, upsert: false } // No upsert; update only if the document exists
    );

    if (!mongoUpdate) {
      console.error(`Failed to assign trade in MongoDB. Staff not found with username: ${staffData.username}`);
    } else {
      console.log(`Trade ${tradePayload.trade_hash} successfully assigned to MongoDB staff ${staffData.username}.`);
    }

    // Add to strict list after successful assignment
    strictAssignedTradeHashes.add(tradePayload.trade_hash);
    console.log(`Trade ${tradePayload.trade_hash} successfully assigned to Firestore staff ${assignedStaffId}.`);
  } catch (error) {
    console.error('Error assigning trade to staff:', error.message || error);
  }
};

// Periodic cleanup of in-memory trade hash sets
setInterval(() => {
  console.log('Clearing assignedTradeHashes and strictAssignedTradeHashes sets to reduce memory usage.');
  assignedTradeHashes.clear();
  strictAssignedTradeHashes.clear();
}, 120000);
 // 120000 ms = 2 minutes







// First list (temporary check for duplicates)
const processedTradeHashes = new Set();

// Second list (strict check to process and save unique trade hashes)
const strictTradeHashes = new Set();

const saveTradeToFirestore = async (payload) => {
  try {
    // Check if the trade is in the first list (processedTradeHashes)
    if (processedTradeHashes.has(payload.trade_hash)) {
      console.log(`Trade ${payload.trade_hash} already exists in the first check list. Skipping initial check.`);
      
      // Now check in the second list (strict check)
      if (strictTradeHashes.has(payload.trade_hash)) {
        console.log(`Trade ${payload.trade_hash} is already processed and saved. Skipping Firestore save.`);
        return; // Exit if trade hash already processed in strict check list
      }

      // Wait for 3 seconds to ensure there are no duplicates when moving to second list
      console.log(`Waiting for 3 seconds before moving trade ${payload.trade_hash} to strict check list...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Add to the second list for strict checking
      strictTradeHashes.add(payload.trade_hash);
      console.log(`Trade ${payload.trade_hash} added to strict check list.`);
    } else {
      // If the trade hash is not in the first list, add it and proceed with saving
      console.log(`Adding trade ${payload.trade_hash} to first check list.`);
      processedTradeHashes.add(payload.trade_hash);
    }

    // Save the trade to Firestore after 3 seconds of verification
    console.log(`Saving trade ${payload.trade_hash} to Firestore...`);
    const docRef = db.collection('manualsystem').doc(payload.trade_hash);
    await docRef.set({
      ...payload,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Noones Trade ${payload.trade_hash} saved to Firestore DB >>>>>>>>>>>>>`);

    // Assign the trade to a staff member
    await assignTradeToStaff(payload);

  } catch (error) {
    console.error('Error saving the trade to Firestore:', error);
  }
};

// Periodically clear the processedTradeHashes and strictTradeHashes every 2 minutes
setInterval(() => {
  console.log('Clearing processedTradeHashes and strictTradeHashes sets to reduce memory load...');
  processedTradeHashes.clear();
  strictTradeHashes.clear();
}, 120000); // 120000 ms = 2 minutes
 // 120000 ms = 2 minutes




 const processedMessageIds = new Set();
 const initializedTrades = new Set(); // Cache to track initialized trades
 
 const saveChatMessageToFirestore = async (payload, messages) => {
   try {
     // Filter out messages that have already been processed
     const uniqueMessages = messages.filter((message) => {
       if (processedMessageIds.has(message.id)) {
         console.log(`Message with ID ${message.id} already processed. Skipping.`);
         return false;
       }
       return true;
     });
 
     if (uniqueMessages.length === 0) {
       console.log(`No new messages to save for trade ${payload.trade_hash}.`);
       return; // Exit if no new unique messages
     }
 
     const docRef = db.collection('manualmessages').doc(payload.trade_hash);
 
     if (!initializedTrades.has(payload.trade_hash)) {
       // Check if trade is already initialized
       const doc = await docRef.get();
       if (!doc.exists) {
         console.log(`Noones Chats for trade ${payload.trade_hash} does not exist. Opening New Chat`);
         await docRef.set({
           trade_hash: payload.trade_hash,
           messages: uniqueMessages,
           timestamp: admin.firestore.FieldValue.serverTimestamp(),
         });
       } else {
         console.log(`Noones Chat for trade ${payload.trade_hash} exists. Adding to thread`);
         await docRef.update({
           messages: admin.firestore.FieldValue.arrayUnion(...uniqueMessages),
           timestamp: admin.firestore.FieldValue.serverTimestamp(),
         });
       }
 
       // Mark the trade as initialized after first interaction
       initializedTrades.add(payload.trade_hash);
     } else {
       console.log(`Trade ${payload.trade_hash} already initialized. Adding messages directly.`);
       await docRef.update({
         messages: admin.firestore.FieldValue.arrayUnion(...uniqueMessages),
         timestamp: admin.firestore.FieldValue.serverTimestamp(),
       });
     }
 
     // Add processed message IDs to the Set after successful save
     uniqueMessages.forEach((message) => processedMessageIds.add(message.id));
 
     console.log(`Noones Chat messages for trade ${payload.trade_hash} saved to Firestore.`);
   } catch (error) {
     console.error('Error saving chat messages to Firestore:', error);
   }
 };
 
 // Periodically clear the processedMessageIds set every 2 minutes
 setInterval(() => {
   console.log('Clearing processedMessageIds set to reduce memory load...');
   processedMessageIds.clear();
 }, 120000); // 120000 ms = 2 minutes
 

// const saveChatMessageToFirestore = async (payload, messages) => {
//     try {
//         const docRef = db.collection('manualmessages').doc(payload.trade_hash);
//         await db.runTransaction(async (transaction) => {
//             const doc = await transaction.get(docRef);
//             if (!doc.exists) {
//                 console.log(`Noones Chats for trade ${payload.trade_hash} does not exist. Opening New Chat`);
//                 transaction.set(docRef, {
//                     trade_hash: payload.trade_hash,
//                     messages: messages,
//                     timestamp: admin.firestore.FieldValue.serverTimestamp(),
//                 });
//             } else {
//                 console.log(`Noones Chat for trade ${payload.trade_hash} exists. Adding to thread`);
//                 transaction.update(docRef, {
//                     messages: admin.firestore.FieldValue.arrayUnion(...messages),
//                     timestamp: admin.firestore.FieldValue.serverTimestamp(),
//                 });
//             }
//         });
//         console.log(`Noones Chat messages for trade ${payload.trade_hash} saved to Firestore.`);
//     } catch (error) {
//         console.error('Error saving chat messages to Firestore:', error);
//     }
// };



// Signature validation function

const isValidSignature = (signature, host, originalUrl, rawBody, publicKey) => {
    const message = `https://${host}${originalUrl}:${rawBody}`;
    return nacl.sign.detached.verify(
        Buffer.from(message, 'utf8'),
        Buffer.from(signature, 'base64'),
        Buffer.from(publicKey, 'base64')
    );
};

const webhookHandler = async (req, res) => {
    const publicKey = 'fvcYFZlQl21obFbW5+RK2/foq8JzK/Y5fCEqg+NEy+k=';

    const challenge = req.headers['x-noones-request-challenge'];

    if (challenge) {
        res.set('x-noones-request-challenge', challenge);
        res.status(200).end();
        return;
    }

    const signature = req.get('x-noones-signature');
    if (!signature || !req.rawBody || req.rawBody.trim() === '') {
        res.status(400).json({ status: 'error', message: 'Invalid request' });
        return;
    }

    if (!isValidSignature(signature, req.get('host'), req.originalUrl, req.rawBody, publicKey)) {
        res.status(403).json({ status: 'error', message: 'Invalid signature' });
        return;
    }

    let parsedBody;
    try {
        parsedBody = JSON.parse(req.rawBody);
    } catch (err) {
        console.warn('Failed to parse webhook body as JSON:', req.rawBody);
        res.status(400).json({ status: 'error', message: 'Invalid JSON body' });
        return;
    }

    // Define your trade started and message handler functions
    const handleTradeStarted = async (payload) => {
        console.log('Handling trade started event:', payload);
        await saveTradeToFirestore(payload);
    };

    const handleTradeMessage = async (payload) => {
        console.log('Handling trade message event:', payload);
        const messages = [{
            id: payload.id,
            timestamp: payload.timestamp,
            type: payload.type,
            trade_hash: payload.trade_hash,
            is_for_moderator: payload.is_for_moderator,
            author: payload.author,
            security_awareness: payload.security_awareness,
            status: payload.status,
            text: payload.text,
            author_uuid: payload.author_uuid,
            sent_by_moderator: payload.sent_by_moderator,
        }];
        await saveChatMessageToFirestore(payload, messages); 
    };


    const webhookType = parsedBody?.type;

    if (webhookType === 'trade.started') {
       await handleTradeStarted(parsedBody.payload);
    } else if (webhookType === 'trade.chat_message_received') {
     await handleTradeMessage(parsedBody.payload);
    } else {

    }


    //console.debug('Valid webhook received:', parsedBody);

    res.status(200).send('Webhook received');
};

module.exports = { webhookHandler };
