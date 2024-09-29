const express = require('express');
const nacl = require('tweetnacl');
const router = express.Router();
const app = express();
const dotenv = require('dotenv').config();
const admin = require("firebase-admin");
const axios = require("axios");
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
const mongoose = require('mongoose');


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


  // Save functions from your existing code

const saveTradeToFirestore = async (payload) => {
    try {
        const docRef = db.collection('manualsystem').doc(payload.trade_hash);
        await docRef.set({
            ...payload,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Trade ${payload.trade_hash} saved to Firestore.`);
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
                console.log(`Document for trade ${payload.trade_hash} does not exist. Creating a new document.`);
                transaction.set(docRef, {
                    trade_hash: payload.trade_hash,
                    messages: messages,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            } else {
                console.log(`Document for trade ${payload.trade_hash} exists. Updating the document.`);
                transaction.update(docRef, {
                    messages: admin.firestore.FieldValue.arrayUnion(...messages),
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        });
        console.log(`Chat messages for trade ${payload.trade_hash} saved to Firestore.`);
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
    
    // Respond to the webhook
   // res.status(200).send('Webhook received');
};

module.exports = { webhookHandler };
