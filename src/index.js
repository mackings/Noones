const crypto = require('crypto');
const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require('body-parser');

// Secret from Noones developer page
const apiSecret = 'FmWKLVTETTYWXfoMjoOkUxF7xvYm8pl8';

// Body parsing middleware
app.use(bodyParser.json());

// Middleware for address verification
app.use((req, res, next) => {
  if (!Object.keys(req.body).length && !req.get('X-Noones-Signature')) {
    console.log('Address verification request received.');
    const challengeHeader = 'X-Noones-Request-Challenge';
    res.set(challengeHeader, req.get(challengeHeader)); // Echo back the challenge
    res.end();
  } else {
    next(); // If not address verification, move to the next middleware
  }
});

// Middleware to verify event notification signature
app.use((req, res, next) => {
  const providedSignature = req.get('X-Noones-Signature');
  
  // Convert request body to string in the same format that Noones sent
  const requestBody = JSON.stringify(req.body);
  const calculatedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(requestBody)
    .digest('hex');
  
  // Log for debugging
  console.log('Provided Signature:', providedSignature);
  console.log('Calculated Signature:', calculatedSignature);
  console.log('Request Body:', requestBody);

  // Check if signatures match
  if (providedSignature !== calculatedSignature) {
    console.log('Request signature verification failed.');
    res.status(403).end(); // Reject the request
    //next();
  } else {
    console.log('Signatures Passed');
    next(); 
  }
});

// Event handler
app.post('*', async (req, res) => {
  console.log('New event received:');
  console.log(req.body); // Log the received event
  // Process the event here...

  res.end(); // End the response after processing
});

// Start the server
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));
