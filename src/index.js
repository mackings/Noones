const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3000;

// Load API secrets for multiple accounts from environment variables
const accountSecrets = {
  'account1': process.env.ACCOUNT1_API_SECRET || 'secret_for_account1',
  'account2': process.env.ACCOUNT2_API_SECRET || 'secret_for_account2',
};

app.use(cors());
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
  const calculatedSignature = crypto
  .createHmac('sha256', apiSecret)
  .update(JSON.stringify(req.body))
  .digest('hex');

  const accountId = req.get('X-Account-ID') || req.headers['x-account-id'];
  console.log(`Received account ID: ${accountId}`);

  if (!accountId || !accountSecrets[accountId]) {
    console.log('Unknown account or missing account ID.');
    return res.status(400).send('Invalid account.');
  }

  const apiSecret = accountSecrets[accountId];

  
  // Check if signatures match
  if (providedSignature !== calculatedSignature) {
    console.log(`Signature verification failed for account: ${accountId}`);
    //return res.status(403).send('Invalid signature.');
    next();
  }else{
    console.log(`Signature verification succeeded for account: ${accountId}`);
    next(); 
  }

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
