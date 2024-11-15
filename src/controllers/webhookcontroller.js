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
const assignedTradeHashes = new Set();

const assignTradeToStaff = async (tradePayload) => {
  try {
    // Check if trade_hash is already assigned in memory
    if (assignedTradeHashes.has(tradePayload.trade_hash)) {
      console.log(`Trade ${tradePayload.trade_hash} is already assigned.`);
      return; // Exit if already assigned
    }

    const staffSnapshot = await db.collection('Allstaff').get();
    let eligibleStaff = [];

    // Filter eligible staff (clocked in and no pending unpaid trades)
    staffSnapshot.docs.forEach((doc) => {
      const staffData = doc.data();
      const hasPendingTrades = staffData.assignedTrades.some((trade) => !trade.isPaid);

      if (!hasPendingTrades && staffData.clockedIn) {
        eligibleStaff.push(doc);
      }

      // Check each staff's assignedTrades for the trade_hash
      if (
        staffData.assignedTrades.some((trade) => trade.trade_hash === tradePayload.trade_hash)
      ) {
        console.log(
          `Trade ${tradePayload.trade_hash} already exists in assignedTrades of staff: ${staffData.name}.`
        );
        assignedTradeHashes.add(tradePayload.trade_hash); // Update memory cache
        console.log(
          `Duplicate trade detected before Firestore. Skipping assignment for ${tradePayload.trade_hash}.`
        );
      }
    });

    if (eligibleStaff.length === 0) {
      console.log('No eligible staff found. Saving trade to manual unassigned collection.');

      // Save the trade in the unassignedTrades collection
      await db.collection('manualunassigned').add({
        trade_hash: tradePayload.trade_hash,
        fiat_amount_requested: tradePayload.fiat_amount_requested,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return;
    }

    // Find staff with the least number of trades
    let staffWithLeastTrades = eligibleStaff[0];
    eligibleStaff.forEach((doc) => {
      if (doc.data().assignedTrades.length < staffWithLeastTrades.data().assignedTrades.length) {
        staffWithLeastTrades = doc;
      }
    });

    const assignedStaffId = staffWithLeastTrades.id; // Firestore document ID
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
        seller_name: tradePayload.seller_name,
        analytics: tradePayload,
      }),
    });

    // Add to in-memory tracking after successful assignment
    assignedTradeHashes.add(tradePayload.trade_hash);

    console.log(`Trade ${tradePayload.trade_hash} successfully assigned to staff ${assignedStaffId}.`);
  } catch (error) {
    console.error('Error assigning trade to staff:', error.message || error);
  }
};






// In-memory tracking of trade hashes
const processedTradeHashes = new Set();

const saveTradeToFirestore = async (payload) => {
  try {
    // Check if the trade has already been processed
    if (processedTradeHashes.has(payload.trade_hash)) {
      console.log(`Trade ${payload.trade_hash} is already processed. Skipping Firestore save.`);
      return; // Exit if already processed
    }

    // Save the trade to Firestore
    const docRef = db.collection('manualsystem').doc(payload.trade_hash);
    await docRef.set({
      ...payload,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Add trade_hash to in-memory cache after saving
    processedTradeHashes.add(payload.trade_hash);

    console.log(`Noones Trade ${payload.trade_hash} saved to Firestore DB >>>>>>>>>>>>>`);

    // Assign the trade to a staff member
    await assignTradeToStaff(payload);
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
