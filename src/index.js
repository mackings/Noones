const crypto = require('crypto');
const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require('body-parser');



// Your API secret from https://noones.com/p2p/account/developer page
//const apiSecret = 'j62Z4JVa6HFReU5fVm9ADM1DcklHreuQ2vR41QcPmTdbCC3F';
  const apiSecret = 'ocHVeF5JhwRH8Dtg2p5BccuZRM3WUPn3nxiGwviGIMDWoIu1';

app.use(bodyParser.json());

// Middleware to handle address verification request
app.use((req, res, next) => {
  // The address verification request doesn't contain a payload and request signature
  if (!Object.keys(req.body).length && !req.get('X-Noones-Signature')) {
    console.log('Address verification request received.');
    const challengeHeader = 'X-Noones-Request-Challenge';
    res.set(challengeHeader, req.get(challengeHeader)); // Echo back the challenge
    res.end(); // End the response
  } else {
    next(); // If not address verification, move to next middleware
  }
});

// Middleware to verify event notification signature
app.use((req, res, next) => {
  const providedSignature = req.get('X-Noones-Signature');
  const calculatedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  // Check if signatures match
  if (providedSignature !== calculatedSignature) {
    console.log('Request signature verification failed.');
    console.log(providedSignature);
    console.log(calculatedSignature);
    //res.status(403).end(); // Reject the request
    next();
  } else {
    next(); // If signature is valid, proceed to event handler
  }
});

// Event handlings
app.post('*', async (req, res) => {
  console.log('New event received:');
  console.log(req.body); // Log the received event
  // Process the event here...
  
  res.end(); // End the response after processing
});

// Start the server
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`));
