const crypto = require('crypto');
const express = require('express');
const app = express();
const port = 3000;
const bodyParser = require('body-parser');

//const apiSecret = 'FmWKLVTETTYWXfoMjoOkUxF7xvYm8pl8';
const apiSecret = "qzhw1I1uEmyK0ORKRU3XRnn7F2ENCOHYAxukdDge8AUJoXYP"

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
    next();
  }
});

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



// const crypto = require('crypto');
// const express = require('express');
// const bodyParser = require('body-parser');
// const app = express();
// const port = 3000;

// // Secret from Noones developer page
// const apiSecret = 'YourUpdatedSecretKeyHere';

// // Middleware to capture raw body for signature verification
// app.use((req, res, next) => {
//   req.rawBody = '';
//   req.on('data', chunk => {
//     req.rawBody += chunk;
//   });
//   req.on('end', () => {
//     next();
//   });
// });

// // Body parsing middleware
// app.use(bodyParser.json({ limit: '50mb' })); // Increase body size limit if needed

// // Middleware for address verification
// app.use((req, res, next) => {
//   if (!Object.keys(req.body).length && !req.get('X-Noones-Signature')) {
//     console.log('Address verification request received.');
//     const challengeHeader = 'X-Noones-Request-Challenge';
//     res.set(challengeHeader, req.get(challengeHeader)); // Echo back the challenge
//     res.end();
//   } else {
//     next(); // If not address verification, move to the next middleware
//   }
// });

// // Middleware to verify event notification signature
// app.use((req, res, next) => {
//   const providedSignature = req.get('X-Noones-Signature');
  
//   // Use raw body for signature calculation
//   const requestBody = req.rawBody;
//   const calculatedSignature = crypto
//     .createHmac('sha256', apiSecret)
//     .update(requestBody)
//     .digest('hex');
  
//   // Log for debugging
//   console.log('Provided Signature:', providedSignature);
//   console.log('Calculated Signature:', calculatedSignature);
//   console.log('Request Body:', requestBody);

//   // Check if signatures match
//   if (providedSignature !== calculatedSignature) {
//     console.log('Request signature verification failed.');
//     res.status(403).end(); // Reject the request
//   } else {
//     console.log('Signatures Passed');
//     next(); 
//   }
// });

// // Event handler
// app.post('*', (req, res) => {
//   console.log('New event received:');
//   console.log(req.body); // Log the received event
//   // Process the event here...

//   res.end(); // End the response after processing
// });

// // Start the server
// app.listen(port, () => console.log(`App listening at http://localhost:${port}`));
