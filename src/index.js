const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Map environment variables to account secrets

const accountSecrets = {
  'account1': process.env.ACCOUNT1_API_SECRET,
  'account2': process.env.ACCOUNT2_API_SECRET,
  'account3': process.env.ACCOUNT3_API_SECRET,
  'account4': process.env.ACCOUNT4_API_SECRET,
  'account5': process.env.ACCOUNT5_API_SECRET,
};

// Middleware to handle address verification request
app.use((req, res, next) => {
  if (!Object.keys(req.body).length && !req.get('X-Noones-Signature')) {
    console.log('Address verification request received.');
    const challengeHeader = 'X-Noones-Request-Challenge';
    res.set(challengeHeader, req.get(challengeHeader)); // Echo back the challenge
    res.end(); // End the response
  } else {
    next(); // Move to the next middleware if it's not address verification
  }
});

// Middleware to verify event notification signature for multiple accounts
app.use((req, res, next) => {
  const providedSignature = req.get('X-Noones-Signature');
  const accountId = req.get('X-Account-ID'); // Use header to identify the account

  if (!accountId || !accountSecrets[accountId]) {
    console.log('Unknown account or missing account ID.');
    return res.status(400).send('Invalid account.');
  }

  const apiSecret = accountSecrets[accountId]; // Get the correct API secret for the account
  const calculatedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (providedSignature !== calculatedSignature) {

    console.log(`Signature verification failed for account: ${accountId}`);
    console.log(providedSignature);
    console.log(calculatedSignature);

    next();
    
   // return res.status(403).send('Invalid signature.');
  }

  console.log(`Signature verification succeeded for account: ${accountId}`);
  next(); // Proceed if signature is valid
});

// Event handling
app.post('*', async (req, res) => {
  const accountId = req.get('X-Account-ID');
  console.log(`New event received for account: ${accountId}`);
  console.log(req.body); // Log the event data
  
  // Add your event processing logic here

  res.end(); // End the response after processing
});

// Start the server
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
