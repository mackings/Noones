const crypto = require('crypto');
const nacl = require('tweetnacl'); // NoOnes uses tweetnacl for signature validation
const express = require('express');
const app = express();
const port = 3000;

// Replace with your actual NoOnes public key and webhook target URL
const NOONES_PUBLIC_KEY = 'oWDUZ6Im3l8TlvS1PpWvHFXX8LS7mkk7brbprpXECTro49wH'; // Public key from NoOnes
const WEBHOOK_TARGET_URL = process.env.WEBHOOK_TARGET_URL || 'https://b-backend-xe8q.onrender.com'; // Your webhook URL

// Middleware to capture raw request body needed for signature validation
app.use((req, res, next) => {
  req.rawBody = '';
  req.on('data', chunk => {
    req.rawBody += chunk;
  });
  req.on('end', () => {
    next();
  });
});

// Function to validate NoOnes signature
const isValidSignature = (signature, rawBody) => {
  const signatureValidationPayload = `${WEBHOOK_TARGET_URL}:${rawBody}`;
  
  return nacl.sign.detached.verify(
    Buffer.from(signatureValidationPayload, 'utf8'),
    Buffer.from(signature, 'base64'),
    Buffer.from(NOONES_PUBLIC_KEY, 'base64')
  );
};

// Middleware to verify event notification signature
app.use((req, res, next) => {
  const providedSignature = req.get('X-Noones-Signature');
  
  if (!providedSignature) {
    console.log('No signature provided in the request');
    return res.status(400).send('Signature required');
  }

  if (!isValidSignature(providedSignature, req.rawBody)) {
    console.log('Request signature verification failed.');
    return res.status(403).send('Invalid signature');
  }

  next(); // If signature is valid, proceed to event handler
});

// Event handler
app.post('*', (req, res) => {
  console.log('New event received:');
  console.log(req.body); // Log the received event
  res.end(); // End the response after processing
});

// Start the server
app.listen(port, () => console.log(`App listening at http://localhost:${port}`));
