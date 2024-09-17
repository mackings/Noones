const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv').config(); // Load environment variables from .env file

const app = express();
const port = 3000;

// Store API secrets for different accounts in a map
const accountSecrets = {
  'account1': process.env.ACCOUNT1_API_SECRET,
  'account2': process.env.ACCOUNT2_API_SECRET,
  'account3': process.env.ACCOUNT3_API_SECRET,
  'account4': process.env.ACCOUNT4_API_SECRET,
  'account5': process.env.ACCOUNT5_API_SECRET,
};

// Print only the loaded API secrets
console.log('Loaded API secrets:', {
  account1: process.env.ACCOUNT1_API_SECRET,
  account2: process.env.ACCOUNT2_API_SECRET,
  account3: process.env.ACCOUNT3_API_SECRET,
  account4: process.env.ACCOUNT4_API_SECRET,
  account5: process.env.ACCOUNT5_API_SECRET,
});

app.use(bodyParser.json());

// Middleware to handle address verification request
app.use((req, res, next) => {
  if (!Object.keys(req.body).length && !req.get('X-Noones-Signature')) {
    console.log('Address verification request received.');
    const challengeHeader = 'X-Noones-Request-Challenge';
    res.set(challengeHeader, req.get(challengeHeader)); // Echo back the challenge
    res.end(); // End the response
  } else {
    next(); // If not address verification, move to next middleware
  }
});

// Middleware to verify event notification signature for multiple accounts
app.use((req, res, next) => {
  const providedSignature = req.get('X-Noones-Signature');
  const accountId = req.get('X-Account-ID'); // Account identifier from request header

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

// Start the server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
