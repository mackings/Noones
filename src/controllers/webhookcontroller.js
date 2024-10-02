const express = require('express');
const nacl = require('tweetnacl');
const router = express.Router();
const app = express();
const dotenv = require('dotenv').config();
const admin = require("firebase-admin");
const axios = require("axios");
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
const mongoose = require('mongoose');
const Allstaff = require("./Model/staffmodel");
const { ObjectId } = mongoose.Types;


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
  db.settings({ ignoreUndefinedProperties: true });





// Firestore listener to detect new messages in the manualmessages collection

// Listen for incoming messages in the manualmessages collection

db.collection('manualmessages').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      const messageData = change.doc.data();
      const messageTradeHash = messageData.trade_hash;

      // Ensure message data is valid and store the message
      if (messageData && messageTradeHash) {
        storeMessage(messageTradeHash, messageData);
      } else {
        console.error('Invalid message data received:', messageData);
      }
    }
  });
});

// Listen for incoming trades in the trades collection
db.collection('manualsystem').onSnapshot(snapshot => {
  snapshot.docChanges().forEach(change => {
    if (change.type === 'added') {
      const tradeData = change.doc.data();
      const tradeHash = tradeData.trade_hash;

      // Ensure trade data is valid and store the trade
      if (tradeData && tradeHash) {
        storeTrade(tradeHash, tradeData);
      } else {
        console.error('Invalid trade data received:', tradeData);
      }
    }
  });
});

// Function to store the message in Firestore
const storeMessage = async (messageTradeHash, messageData) => {
  try {
    // Store the message in a dedicated collection
    await db.collection('manualmessages').doc(messageTradeHash).set(messageData, { merge: true });
    console.log(`Message stored for trade ${messageTradeHash}`);

    // Once the message is stored, check if the trade is already available and assign it
    await checkAndAssignTrade(messageTradeHash);
  } catch (error) {
    console.error('Error storing message:', error);
  }
};

// Function to store the trade in Firestore
const storeTrade = async (tradeHash, tradeData) => {
  try {
    // Store the trade in a dedicated collection
    await db.collection('manualsystem').doc(tradeHash).set(tradeData, { merge: true });
    console.log(`Trade stored with trade_hash: ${tradeHash}`);

    // Once the trade is stored, check if a corresponding message exists and assign it
    await checkAndAssignTrade(tradeHash);
  } catch (error) {
    console.error('Error storing trade:', error);
  }
};

// Function to check if a message exists for the trade and assign it
const checkAndAssignTrade = async (tradeHash) => {
  try {
    // Check if the trade exists
    const tradeSnapshot = await db.collection('manualsystem').doc(tradeHash).get();
    if (!tradeSnapshot.exists) {
      console.log(`Trade ${tradeHash} not found. Skipping assignment.`);
      return;
    }

    // Check if a message exists with the same trade_hash
    const messageSnapshot = await db.collection('manualmessages').doc(tradeHash).get();
    if (!messageSnapshot.exists) {
      console.log(`No message found for trade ${tradeHash}, skipping assignment.`);
      return;
    }

    const tradeData = tradeSnapshot.data();
    const messageData = messageSnapshot.data();

    // Proceed with trade assignment if a message is found
    console.log(`Assigning trade ${tradeHash} with corresponding message.`);
    const tradePayload = {
      trade_hash: tradeHash,
      fiat_amount_requested: tradeData.payload.fiat_amount_requested,
      buyer_name: tradeData.payload.buyer_name,
    };

    await assignTradeToStaff(tradePayload);

  } catch (error) {
    console.error('Error checking for messages or assigning trade:', error);
  }
};

// Function to assign the trade to eligible staff
const assignTradeToStaff = async (tradePayload) => {

  try {
    // Query for clocked-in staff who do not have pending unpaid trades
    const staffSnapshot = await db.collection('Allstaff')
      .where('clockedIn', '==', true) // Only staff who are clocked in
      .get();

    const eligibleStaff = staffSnapshot.docs.filter(doc => {
      const staffData = doc.data();
      // Check for pending unpaid trades
      const hasPendingTrades = staffData.assignedTrades.some(trade => trade.tradeDetails && trade.tradeDetails.isPaid === false);
      return !hasPendingTrades; // Only include staff without pending trades
    });

    if (eligibleStaff.length === 0) {
      console.log('No eligible staff available to assign the trade.');
      await db.collection('manualunassigned').add({
        trade_hash: tradePayload.trade_hash,
        fiat_amount_requested: tradePayload.fiat_amount_requested,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Find the staff with the least number of trades
    let staffWithLeastTrades = eligibleStaff.reduce((prev, curr) => {
      return (curr.data().assignedTrades.length < prev.data().assignedTrades.length) ? curr : prev;
    });

    const assignedStaffId = staffWithLeastTrades.id;
    const staffRef = db.collection('Allstaff').doc(assignedStaffId);
    const assignedAt = new Date();

    // Update the assignedTrades array in Firestore
    await staffRef.update({
      assignedTrades: admin.firestore.FieldValue.arrayUnion({
        trade_hash: tradePayload.trade_hash,
        fiat_amount_requested: tradePayload.fiat_amount_requested,
        assignedAt: assignedAt,
        handle: tradePayload.buyer_name,
        account: "Noones",
        isPaid: false,
      }),
    });

    // Update the assignedTrades array in MongoDB
    const tradeData = {
      tradeId: tradePayload.trade_hash,
      tradeDetails: {
        fiat_amount_requested: tradePayload.fiat_amount_requested,
        assignedAt: assignedAt,
        isPaid: false,
      },
    };

    // Ensure assignedStaffId is converted to ObjectId before MongoDB update
    await Allstaff.findOneAndUpdate(
      { _id: new ObjectId(assignedStaffId) },
      { $push: { assignedTrades: tradeData } },
      { new: true }
    );

    console.log(`Trade ${tradePayload.trade_hash} assigned to staff ${assignedStaffId}.`);

  } catch (error) {
    console.error('Error assigning trade to staff:', error);
  }
};


  
  
  

const saveTradeToFirestore = async (payload) => {
    try {
        const docRef = db.collection('manualsystem').doc(payload.trade_hash);
        await docRef.set({
            ...payload,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        await assignTradeToStaff(payload);
        console.log(`Noones Trade ${payload.trade_hash} saved to Firestore DB >>>>>>>>>>>>>`);
    } catch (error) {
        console.error('Error saving the trade to Firestore:', error);
    }
};



const saveChatMessageToFirestore = async (payload, messages) => {
    try {
        const docRef = db.collection('manualmessages').doc(payload.trade_hash);
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            if (!doc.exists) {
                console.log(`Noones Chats for trade ${payload.trade_hash} does not exist. Opening New Chat`);
                transaction.set(docRef, {
                    trade_hash: payload.trade_hash,
                    messages: messages,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                console.log(`Noones Chat for trade ${payload.trade_hash} exists. Adding to thread`);
                transaction.update(docRef, {
                    messages: admin.firestore.FieldValue.arrayUnion(...messages),
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        });
        console.log(`Noones Chat messages for trade ${payload.trade_hash} saved to Firestore.`);
    } catch (error) {
        console.error('Error saving chat messages to Firestore:', error);
    }
};



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


    // Check the webhook type and call the respective handler function
    const webhookType = parsedBody?.type;

    if (webhookType === 'trade.started') {
        await handleTradeStarted(parsedBody.payload);
    } else if (webhookType === 'trade.chat_message_received') {
        await handleTradeMessage(parsedBody.payload);
    } else {

    }



    console.debug('Valid webhook received:', parsedBody);

    res.status(200).send('Webhook received');
};

module.exports = { webhookHandler };
