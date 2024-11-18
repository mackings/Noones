const express = require('express');
const nacl = require('tweetnacl');
const router = express.Router();
const app = express();
const dotenv = require('dotenv').config();
const admin = require("firebase-admin");
const axios = require("axios");
const cron = require('node-cron');
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

  const manualUnassignedSchema = new mongoose.Schema({
    account: { type: String, required: true },
    analytics: { type: Object, required: true },
    isPaid: { type: Boolean, default: false },
    assignedAt: { type: Date, default: Date.now },
    trade_hash: { type: String, required: true },
    seller_name: { type: String, required: true },
    handle: { type: String, required: true },
    fiat_amount_requested: { type: Number, required: true }
  });
  
  // Create a model for the collection
  const ManualUnassigned = mongoose.model('ManualUnassigned', manualUnassignedSchema);


  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  
  const db = admin.firestore();




const assignedTradeHashes = new Set();
const strictAssignedTradeHashes = new Set();

const assignTradeToStaff = async (tradePayload) => {
  try {
    // First list check to avoid duplicate trade assignments
    if (assignedTradeHashes.has(tradePayload.trade_hash)) {
      //console.log(`Trade ${tradePayload.trade_hash} is already being processed.`);
      //console.log(`Waiting 3 seconds before adding trade ${tradePayload.trade_hash} to the strict check list.`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      strictAssignedTradeHashes.add(tradePayload.trade_hash);
     // console.log(`Trade ${tradePayload.trade_hash} added to the strict check list.`);
    } else {
      console.log(`Adding trade ${tradePayload.trade_hash} to the first check list.`);
      assignedTradeHashes.add(tradePayload.trade_hash);
    }

    // Strict duplicate check before processing
    if (strictAssignedTradeHashes.has(tradePayload.trade_hash)) {
     // console.log(`Trade ${tradePayload.trade_hash} already assigned or processed. Skipping assignment.`);
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
       // console.log(`Trade ${tradePayload.trade_hash} already exists for staff: ${staffData.name}.`);
        strictAssignedTradeHashes.add(tradePayload.trade_hash);
        console.log(`Duplicate trade detected. Skipping assignment for ${tradePayload.trade_hash}.`);
      }
    });

    if (eligibleStaff.length === 0) {
      console.log('No eligible staff found. Saving trade to manual unassigned collection.');
    
      // Create a new document using the model
      const manualUnassignedTrade = new ManualUnassigned({
        account: "Noones",
        analytics: tradePayload,
        trade_hash: tradePayload.trade_hash,
        seller_name: tradePayload.seller_name,
        handle: tradePayload.buyer_name,
        fiat_amount_requested: tradePayload.fiat_amount_requested
      });
    
      try {
        await manualUnassignedTrade.save();
        console.log('Trade saved to Mongoose manualUnassigned collection.');
      } catch (error) {
        console.error('Error saving trade:', error);
      }
    
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
 // console.log('Clearing assignedTradeHashes and strictAssignedTradeHashes sets to reduce memory usage.');
  assignedTradeHashes.clear();
  strictAssignedTradeHashes.clear();
}, 120000);
 // 120000 ms = 2 minutes




 
 const assignUnassignedTrades = async () => {
  try {
    // Step 1: Find free staff in MongoDB (clocked in and no pending unpaid trades)
    console.log("Fetching free staff from MongoDB...");
    const freeStaff = await Allstaff.find({
      clockedIn: true, // Only consider staff who are clocked in
      "assignedTrades.isPaid": { $ne: false }, // Staff with no unpaid trades
    });

    if (freeStaff.length === 0) {
      console.log("No eligible staff available to assign unassigned trades.");
      return;
    }

    // Step 2: Fetch all unassigned trades from MongoDB
    console.log("Fetching unassigned trades from MongoDB...");
    const unassignedTrades = await ManualUnassigned.find().sort({ assignedAt: 1 });

    if (unassignedTrades.length === 0) {
      console.log("No unassigned trades available in MongoDB.");
      return;
    }

    // Step 3: Loop through unassigned trades and assign them to staff
    for (const unassignedTrade of unassignedTrades) {
      // Find staff that are clocked in and have no unpaid trades
      const staffWithNoUnpaidTrades = freeStaff.find(staff =>
        staff.assignedTrades.every(trade => trade.isPaid === true) // Ensure no unpaid trades
      );

      if (!staffWithNoUnpaidTrades) {
        console.log("No staff available to assign trade.");
        continue; // Move to the next unassigned trade
      }

      const assignedStaffUsername = staffWithNoUnpaidTrades.username;

      // Step 4: Assign the trade to the selected staff in Firestore
      console.log(
        `Assigning trade ${unassignedTrade.trade_hash} to staff ${assignedStaffUsername} in Firestore...`
      );

      const staffRef = admin.firestore().collection("Allstaff").doc(assignedStaffUsername);

      await staffRef.update({
        assignedTrades: admin.firestore.FieldValue.arrayUnion({
          account: unassignedTrade.account.toString(),
          analytics: unassignedTrade.analytics,
          isPaid: false,
          assignedAt: admin.firestore.Timestamp.now(),
          trade_hash: unassignedTrade.trade_hash.toString(),
          seller_name: unassignedTrade.seller_name.toString(),
          handle: unassignedTrade.handle.toString(),
          fiat_amount_requested: `"${unassignedTrade.fiat_amount_requested}"`
        }),
      });

      // Step 5: Update the staff record in MongoDB
      console.log(`Updating staff ${assignedStaffUsername} in MongoDB...`);
      staffWithNoUnpaidTrades.assignedTrades.push({
        account: unassignedTrade.account,
        analytics: unassignedTrade.analytics,
        isPaid: false,
        assignedAt: admin.firestore.Timestamp.now().toDate(),
        trade_hash: unassignedTrade.trade_hash,
        seller_name: unassignedTrade.seller_name,
        handle: unassignedTrade.handle,
        fiat_amount_requested: `"${unassignedTrade.fiat_amount_requested}"`
      });
      await staffWithNoUnpaidTrades.save();

      // Step 6: Delete the assigned trade from MongoDB
      console.log(`Removing trade ${unassignedTrade.trade_hash} from MongoDB...`);
      await ManualUnassigned.deleteOne({ _id: unassignedTrade._id });

      console.log(`Trade ${unassignedTrade.trade_hash} successfully assigned to ${assignedStaffUsername}.`);
    }

    // console.log("All available unassigned trades have been assigned.");
  } catch (error) {
    console.error("Error assigning unassigned trade:", error.message || error);
  }
};





// Function to continuously process unassigned trades
const processUnassignedTrades = async () => {

  try {
  //  console.log("Checking for unassigned trades...");
    while (true) {
    //  console.log("Attempting to assign an unassigned trade...");
      await assignUnassignedTrades();

      // Check if any unassigned trades remain in MongoDB
      const remainingTrades = await ManualUnassigned.countDocuments();
      if (remainingTrades === 0) {
        console.log("No unassigned trades remaining.");
        break;
      }
    }
    console.log("All unassigned trades have been processed.");
  } catch (error) {
    console.error("Error processing unassigned trades:", error.message || error);
  }
};

// // Schedule a cron job to run every minute
// cron.schedule("*/1 * * * *", async () => {
//   console.log("Running cron job for unassigned trades...");
//   await processUnassignedTrades();
// });






// First list (temporary check for duplicates)
const processedTradeHashes = new Set();

// Second list (strict check to process and save unique trade hashes)
const strictTradeHashes = new Set();

const saveTradeToFirestore = async (payload) => {
  try {
    // Check if the trade is in the first list (processedTradeHashes)
    if (processedTradeHashes.has(payload.trade_hash)) {
     // console.log(`Trade ${payload.trade_hash} already exists in the first check list. Skipping initial check.`);
      
      // Now check in the second list (strict check)
      if (strictTradeHashes.has(payload.trade_hash)) {
        console.log(`Trade ${payload.trade_hash} is already processed and saved. Skipping Firestore save.`);
        return; // Exit if trade hash already processed in strict check list
      }

      // Wait for 3 seconds to ensure there are no duplicates when moving to second list
     // console.log(`Waiting for 3 seconds before moving trade ${payload.trade_hash} to strict check list...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Add to the second list for strict checking
      strictTradeHashes.add(payload.trade_hash);
      console.log(`Trade ${payload.trade_hash} added to strict check list.`);
    } else {
      // If the trade hash is not in the first list, add it and proceed with saving
     // console.log(`Adding trade ${payload.trade_hash} to first check list.`);
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
//  console.log('Clearing processedTradeHashes and strictTradeHashes sets to reduce memory load...');
  processedTradeHashes.clear();
  strictTradeHashes.clear();
}, 120000); // 120000 ms = 2 minutes
 // 120000 ms = 2 minutes






 const normalProcessingMessages = new Map(); // Tracks messages for normal processing
 const strictProcessingMessages = new Map(); // Tracks unique messages for strict processing
 
 const saveChatMessageToFirestore = async (payload, messages) => {
   try {
     // First list: Filter out duplicates for normal processing
     const normalMessages = messages.filter((message) => {
       const existingMessages = normalProcessingMessages.get(message.trade_hash) || new Set();
 
       if (existingMessages.has(message.id)) {
        // console.log(`Message ID ${message.id} for trade ${message.trade_hash} already processed in normal check. Skipping.`);
         return false;
       }
 
       // Mark the message as processed in the normal list
       existingMessages.add(message.id);
       normalProcessingMessages.set(message.trade_hash, existingMessages);
       return true;
     });
 
     if (normalMessages.length === 0) {
      // console.log(`No new messages to process for trade ${payload.trade_hash} in normal list.`);
       return; // Exit if no new messages for normal processing
     }
 
     // Second list: Strict check to ensure no duplicate trade_hash and text in Firestore
     const uniqueMessages = normalMessages.filter((message) => {
       const existingTexts = strictProcessingMessages.get(message.trade_hash) || new Set();
 
       if (existingTexts.has(message.text)) {
       //  console.log(`Duplicate message text for trade ${message.trade_hash}: "${message.text}". Skipping strict check.`);
         return false;
       }
 
       // Mark the message as processed in the strict list
       existingTexts.add(message.text);
       strictProcessingMessages.set(message.trade_hash, existingTexts);
       return true;
     });
 
     if (uniqueMessages.length === 0) {
      // console.log(`No new unique messages to save for trade ${payload.trade_hash} in strict list.`);
       return; // Exit if no unique messages for strict processing
     }
 
     // Save to Firestore
     const docRef = db.collection('manualmessages').doc(payload.trade_hash);
     const doc = await docRef.get();
 
     if (!doc.exists) {
       console.log(`Initializing chat for trade ${payload.trade_hash}.`);
       await docRef.set({
         trade_hash: payload.trade_hash,
         messages: uniqueMessages,
         timestamp: admin.firestore.FieldValue.serverTimestamp(),
       });
     } else {
      // console.log(`Updating chat for trade ${payload.trade_hash}.`);
       await docRef.update({
         messages: admin.firestore.FieldValue.arrayUnion(...uniqueMessages),
         timestamp: admin.firestore.FieldValue.serverTimestamp(),
       });
     }
 
     console.log(`Messages for trade ${payload.trade_hash} saved successfully.`);
   } catch (error) {
     console.error('Error saving chat messages to Firestore:', error);
   }
 };
 
 // Periodically clear the two maps to reduce memory load
 setInterval(() => {
  // console.log('Clearing normalProcessingMessages and strictProcessingMessages maps to reduce memory load...');
   normalProcessingMessages.clear();
   strictProcessingMessages.clear();
 }, 120000); // Clear every 2 minutes
 




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
        //console.log('Handling trade started event:', payload);
        await saveTradeToFirestore(payload);
    };

    const handleTradeMessage = async (payload) => {
      //  console.log('Handling trade message event:', payload);
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

module.exports = {
  webhookHandler,
  serviceAccount,
};

