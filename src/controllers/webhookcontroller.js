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
const NodeCache = require('node-cache');
const querystring = require('querystring');
const ObjectId = mongoose.Types.ObjectId;
const tradeCache = new NodeCache({ stdTTL: 3600 });
const sentMessagesCache = new NodeCache({ stdTTL: 3600 });









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



// Newest Saving of Trades

const processedCache = new NodeCache({ stdTTL: 2 }); // Temporary deduplication (2 seconds)
const strictCache = new NodeCache({ stdTTL: 300 }); // Strict deduplication (10 minutes)

/**
 * Saves a trade to Firestore with in-memory deduplication checks.
 * @param {Object} payload - The trade data to save.
 */
const saveTradeToFirestore = async (payload) => {
  try {
    const tradeHash = payload.trade_hash;

    // Step 1: Strict Deduplication - Skip if already saved
    if (strictCache.has(tradeHash)) {
      return; 
    }

    // Step 2: Temporary Deduplication - Skip if being processed
    if (processedCache.has(tradeHash)) {

      return; // Exit if the trade is being processed
    }

    processedCache.set(tradeHash, true); // Mark as being processed (expires in 2 seconds)

    // Save to Firestore
   // console.log(`Saving trade ${tradeHash} to Firestore...`);
    const docRef = db.collection('manualsystem').doc(tradeHash);
    await docRef.set({
      ...payload,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mark as strictly processed
    console.log(`Trade ${tradeHash} saved successfully.`);
    strictCache.set(tradeHash, true); // Mark as strictly processed (expires in 10 minutes)

    // Optional post-save actions (e.g., assign to staff)
    await assignTradeToStaff(payload);

  } catch (error) {
    console.error(`Error saving trade ${payload.trade_hash} to Firestore:`, error);
  }
};



//Messages New

const messageProcessingCache = new NodeCache({ stdTTL: 2 }); // Temporary deduplication for message processing (2 seconds)
const tradeMessageCache = new NodeCache({ stdTTL: 300 }); // Strict deduplication for unique trade messages (5 minutes)

/**
 * Saves a trade chat message to Firestore with in-memory deduplication checks.
 * @param {Object} payload - The trade data to save.
 * @param {Array} messages - The list of messages to process.
 */
const saveChatMessageToFirestore = async (payload, messages) => {
  try {
    // Step 1: Normal deduplication (Skip if already processed in messageProcessingCache)
    const normalMessages = messages.filter((message) => {
      const existingMessages = messageProcessingCache.get(message.trade_hash) || new Set();
      
      if (existingMessages.has(message.id)) {
        // If this message has already been processed for this trade_hash, skip it.
        return false;
      }

      // Mark the message as processed for this trade_hash in the messageProcessingCache
      existingMessages.add(message.id);
      messageProcessingCache.set(message.trade_hash, existingMessages);
      return true;
    });

    if (normalMessages.length === 0) {
     // console.log(`No new messages to process for trade ${payload.trade_hash} in messageProcessingCache.`);
      return; // Exit if no new messages for normal processing
    }

    // Step 2: Strict deduplication (Skip if already saved to Firestore for the same trade_hash and text)
    const uniqueMessages = normalMessages.filter((message) => {
      const existingTexts = tradeMessageCache.get(message.trade_hash) || new Set();
      
      if (existingTexts.has(message.text)) {
        // If this message text has already been processed for this trade_hash, skip it.
        return false;
      }

      // Mark the message as strictly processed for this trade_hash and text in the tradeMessageCache
      existingTexts.add(message.text);
      tradeMessageCache.set(message.trade_hash, existingTexts);
      return true;
    });

    if (uniqueMessages.length === 0) {
     // console.log(`No new unique messages to save for trade ${payload.trade_hash} in tradeMessageCache.`);
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

      //console.log(`Updating chat for trade ${payload.trade_hash}.`);
      await docRef.update({
        messages: admin.firestore.FieldValue.arrayUnion(...uniqueMessages),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    }

   // console.log(`Messages for trade ${payload.trade_hash} saved successfully.`);
  } catch (error) {
    console.error('Error saving chat messages to Firestore:', error);
  }
};




//Webhook Center 


const accounts = [

  {
    clientId: '92twe0hGBcx9fN2dRDldyp498r8wSFjAyu31AJepJHgTxaGe',
    clientSecret: 'crmf6iwp9l13PubYPFsnZrHjd8BoWNc0JBgaqAZ6Q6f8HPrj',
    username: 'SnugSleeper88',
},

  {
      clientId: 'Yq0XIIVCnyjYgDKJBUg0Atz37uFKFNAt66r13PnLkGK9cvTI',
      clientSecret: 'o5hICv2hrS8Vmuq2jrOmZj9WwMX4rCWIi6mPscfYCQrH2zyi',
      username: 'boompay',
  },


];


const tokens = {};

// Cleanup old tokens for usernames that no longer exist in `accounts`
const cleanupTokens = () => {
  const validUsernames = accounts.map(acc => acc.username.toLowerCase()); // Get all valid usernames
  const tokenUsernames = Object.keys(tokens);

  tokenUsernames.forEach(username => {
      if (!validUsernames.includes(username.toLowerCase())) {
          console.log(`Removing token for old username: ${username}`);
          delete tokens[username];
      }
  });
};

const getnoonesToken = async (clientId, clientSecret) => { 
  const tokenEndpoint = 'https://auth.noones.com/oauth2/token';
  console.log(`Requesting token for client: ${clientId}`);

  const response = await axios.post(
      tokenEndpoint,
      querystring.stringify({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
      }),
      {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
  );

 // console.log(`Token Received for client: ${clientId}`);
  return response.data.access_token;
};

const getTokenForAccount = async (username) => {
 // console.log("Validating username:", username);

  // Cleanup tokens before processing
  cleanupTokens();

  // Check if the account exists in the `accounts` array (case-insensitive match)
  const account = accounts.find(acc => acc.username.toLowerCase() === username.toLowerCase());
  if (!account) {
     // console.warn(`Account not found for username: ${username}. This username will be skipped.`);
      throw new Error(`Invalid username: ${username}`);
  }

  const now = Date.now();

  // Check if a token exists and is still valid
  if (tokens[username] && tokens[username].expiry > now) {
      console.log(`Using cached token for ${username}`);
      return tokens[username].token;
  }




  try {
      console.log(`Fetching a new token for ${username}`);
      const token = await getnoonesToken(account.clientId, account.clientSecret);

      // Save the new token with an expiry time
      tokens[username] = {
          token,
          expiry: now + 5 * 60 * 60 * 1000, // Token expiry set to 5 hours
      };

      console.log(`New token saved for ${username}`);
      return tokens[username].token;
  } catch (error) {
      console.error(`Failed to fetch token for ${username}:`, error.message);
      throw error;
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


      const handleTradeStarted = async (payload) => {
        await saveTradeToFirestore(payload);
    };

    const handleTradeMessage = async (payload) => {

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
    const payload = parsedBody?.payload;
    
    const sendMessage = async (username, tradeHash, message, eventType) => {

        try {
            // Check if the message for this tradeHash and eventType has already been sent
            const sentKey = `${tradeHash}:${eventType}`;
            if (sentMessagesCache.get(sentKey)) {
                console.log(`Message for event "${eventType}" and tradeHash "${tradeHash}" already sent. Skipping.`);
                return;
            }
    
            console.log(`Attempting to send message: "${message}" for username: "${username}" and tradeHash: "${tradeHash}"`);
    
            const token = await getTokenForAccount(username);
            console.log(`Token fetched for ${username}: ${token}`);
    
            const apiUrl = 'https://api.noones.com/noones/v1/trade-chat/post';
            const response = await axios.post(
                apiUrl,
                new URLSearchParams({ trade_hash: tradeHash, message }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        Authorization: `Bearer ${token}`,
                    },
                }
            );
    
            console.log(`Message successfully sent for ${username}:`, response.data);
    
            // Mark this message as sent
            sentMessagesCache.set(sentKey, true);
        } catch (error) {
            if (error.response) {
                console.error(`Error sending message for ${username}:`, error.response.data);
            } else {
                console.error(`Error sending message for ${username}:`, error.message);
            }
        }
    };





if (webhookType === 'trade.started') {
    await handleTradeStarted(parsedBody.payload);

    const buyerName = payload?.buyer_name;
    const tradeHash = payload?.trade_hash;

    if (!buyerName || !tradeHash) {
        console.warn('Missing buyer_name or trade_hash in trade.started payload');
        res.status(400).json({ status: 'error', message: 'Invalid trade.started payload' });
        return;
    }

    // Store tradeHash and buyerName in cache
    tradeCache.set(tradeHash, buyerName);

    // Send welcome message
    await sendMessage(buyerName, tradeHash, 'Trade has started. Welcome!', 'trade.started');
} else if (webhookType === 'trade.chat_message_received') {
    await handleTradeMessage(parsedBody.payload);

    const tradeHash = payload?.trade_hash;
    const messageText = payload?.text;
' '
    if (!tradeHash || !messageText) {
        console.warn('Missing tradeHash or messageText in trade.chat_message_received payload');
        res.status(400).json({ status: 'error', message: 'Invalid trade.chat_message_received payload' });
        return;
    }

    const username = tradeCache.get(tradeHash);
    if (!username) {
        console.error(`No buyer_name found in cache for tradeHash: ${tradeHash}`);
        return;
    }

    const accountNumberRegex = /\b\d{10}\b/;
    const bankKeywordRegex = /\bBank\b/i;

    if (accountNumberRegex.test(messageText)) {
        console.log('Account Detected:', messageText);
        await sendMessage(username, tradeHash, 'Account number received', 'account.detected');
    } else if (bankKeywordRegex.test(messageText)) {
        console.log('Bank keyword detected:', messageText);
        await sendMessage(username, tradeHash, 'Bank details received', 'bank.details');
    } else {
        console.log('No actionable keywords detected in message');
    }
} else if (webhookType === 'bank-account-instruction') {
    const tradeHash = payload?.trade_hash;
    const username = tradeCache.get(tradeHash) || 'defaultUsername';

    await sendMessage(username, tradeHash, 'Please provide your bank account details as per the instructions.', 'bank.instruction');
} else if (webhookType === 'trade.bank_account_shared') {
    const tradeHash = payload?.trade_hash;
    const username = tradeCache.get(tradeHash) || 'defaultUsername';

    await sendMessage(username, tradeHash, 'Account Seen, I will run it now.', 'bank.account.shared');
} else if (webhookType === 'trade.bank_account_selected') {
    const tradeHash = payload?.trade_hash;
    const username = tradeCache.get(tradeHash) || 'defaultUsername';

    await sendMessage(username, tradeHash, 'I don see am Boss. I go run am now.', 'bank.account.selected');
} else if (webhookType === 'trade.cancelled_or_expired') {
    const tradeHash = payload?.trade_hash;
    const username = tradeCache.get(tradeHash) || 'defaultUsername';

    await sendMessage(username, tradeHash, 'We hate to see you go. Let’s have a better trade next time.', 'trade.cancelled_or_expired');
} else {
    console.warn('Unhandled webhook type:', webhookType);
}




  res.status(200).send('Webhook received');
  //console.log(payload);
};





module.exports = {
  webhookHandler,
  serviceAccount,
};

