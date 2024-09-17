const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const nacl = require('tweetnacl'); // For NaCl signature verification

const app = express();
const port = 3000;

// Your API secret and public key (replace with your actual keys)
const apiSecret = 'ocHVeF5JhwRH8Dtg2p5BccuZRM3WUPn3nxiGwviGIMDWoIu1';
const publicKey = 'oWDUZ6Im3l8TlvS1PpWvHFXX8LS7mkk7brbprpXECTro49wH';

app.use(bodyParser.json());

// Middleware for handling address verification requests and saving the raw body
app.use((req, res, next) => {
  req.rawBody = ''; // Initialize rawBody
  req.on('data', (chunk) => {
    req.rawBody += chunk;
  });

  // Check if it's an address verification request (no body, no signature)
  if (!Object.keys(req.body).length && !req.get('X-Noones-Signature')) {
    console.log('Address verification request received.');
    const challengeHeader = 'X-Noones-Request-Challenge';
    res.set(challengeHeader, req.get(challengeHeader));
    res.end();
  } else {
    next();
  }
});

// Middleware for verifying event notification signature
app.use((req, res, next) => {
  const providedSignature = req.get('X-Noones-Signature');

  // If there's no signature, reject the request
  if (!providedSignature) {
    console.warn('No signature provided in the request');
    res.status(403).json({ status: 'error', message: 'No signature header' });
    return;
  }

  // Calculate the signature
  const calculatedSignature = crypto
    .createHmac('sha256', apiSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  // Compare the calculated signature with the provided signature
  if (providedSignature !== calculatedSignature) {
    console.warn('Request signature verification failed.');
    res.status(403).json({ status: 'error', message: 'Invalid signature' });
  } else {
    next();
  }
});

// Helper function for validating NaCl signatures (if needed for extra verification)
const isValidSignature = (signature, host, originalUrl, rawBody) => {
  const message = `https://${host}${originalUrl}:${rawBody}`;
  return nacl.sign.detached.verify(
    Buffer.from(message, 'utf8'),
    Buffer.from(signature, 'base64'),
    Buffer.from(publicKey, 'base64')
  );
};

// Webhook route handler
app.post('*', async (req, res) => {
  console.log('Webhook received with headers:', req.headers);

  // Check if the request is a validation request
  const isValidationRequest = req.body.type === undefined;
  if (isValidationRequest) {
    console.debug('Validation request arrived');
    res.json({ status: 'ok' });
    return;
  }

  // If signature is valid, process the event
  console.debug('New incoming webhook >>>>');
  console.debug(req.body);

  const type = req.body.type;
});

// Start the server
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));
