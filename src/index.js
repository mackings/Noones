const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config();
const cors = require('cors');
const http = require('http');
const app = express();
const port = 3000;


// Load API secrets for multiple accounts from environment variables

const accountSecrets = {
  'account1': process.env.ACCOUNT1_API_SECRET,
  'account2': process.env.ACCOUNT2_API_SECRET,
};


console.log('Loaded API secrets:', accountSecrets);

app.use(cors());
app.use(bodyParser.json());

// Middleware to handle address verification requests
app.use((req, res, next) => {

  if (!Object.keys(req.body).length && !req.get('X-Noones-Signature')) {
    console.log('Address verification request received.');
    const challengeHeader = 'X-Noones-Request-Challenge';
    res.set(challengeHeader, req.get(challengeHeader)); // Echo back the challenge
    res.end(); // End the response
  } else {
    next(); // If not an address verification, move to next middleware
  }
});

// Middleware to verify event notification signature for multiple accounts
app.use((req, res, next) => {

  const providedSignature = req.get('X-Noones-Signature');
  const accountId = req.get('X-Account-ID'); 

  console.log(`Received account ID: ${accountId}`);
  if (!accountId || !accountSecrets[accountId]) {
    console.log('Unknown account or missing account ID.');
    return res.status(400).send('Invalid account.');
  }

  const apiSecret = accountSecrets[accountId]; // Retrieve the correct API secret for the account
  const calculatedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  // Check if signatures match
  if (providedSignature !== calculatedSignature) {

    console.log(`Request signature verification failed for account: ${accountId}`);
    console.log(`Provided signature: ${providedSignature}`);
    console.log(`Calculated signature: ${calculatedSignature}`);
    return res.status(403).send('Invalid signature.');
    
  }

  console.log(`Signature verification succeeded for account: ${accountId}`);
  next(); // Proceed to event handler if signature is valid
});

// Event handling
app.post('*', async (req, res) => {
  const accountId = req.get('X-Account-ID');
  console.log(`New event received for account: ${accountId}`);
  console.log(req.body); // Log the received event
  
  // Process the event based on the account
  
  res.end(); // End the response after processing
});

// Keep-alive mechanism
const keepAlive = () => {
  http.get(`http://localhost:${port}`);
  console.log('Keep-alive ping sent.');
};

setInterval(keepAlive, 120000); // Keep alive every 2 minutes

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
