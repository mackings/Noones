// const express = require('express');
// const bodyParser = require('body-parser');
// const axios = require('axios');
// const querystring = require('querystring');
// const nacl = require('tweetnacl');

// const app = express();
// const port = 3000;
// //const publicKey = 'fvcYFZlQl21obFbW5+RK2/foq8JzK/Y5fCEqg+NEy+k=';
// const publicKey = "dwRTVx5ksV2UXq1JGZEusw0vTDcxdkmi4H53xiyfDmBYYuqo"
// const webhookTargetUrl = 'https://b-backend-xe8q.onrender.com';

// let accessToken = null;
// let tokenExpiry = 0;


// const getAccessToken = async () => {
//     const tokenEndpoint = 'https://auth.noones.com/oauth2/token';
//     const clientId = 'jiL7JmBC7AZt7KIBx6ngzDhMcFY29Afcq1siKtVbjnjPHvSV';
//     const clientSecret = 'qzhw1I1uEmyK0ORKRU3XRnn7F2ENCOHYAxukdDge8AUJoXYP';

//     try {
//         const response = await axios.post(tokenEndpoint, querystring.stringify({
//             grant_type: 'client_credentials',
//             client_id: clientId,
//             client_secret: clientSecret,
//         }), {
//             headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
//         });

//         return response.data;
//     } catch (error) {
//         console.error('Error getting access token:', error.response ? error.response.data : error.message);
//         throw error;
//     }
// };


// const refreshToken = async () => {
//     const tokenData = await getAccessToken();
//     accessToken = tokenData.access_token;
//     tokenExpiry = Date.now() + tokenData.expires_in * 1000;
// };

// const getValidAccessToken = async () => {
//     if (!accessToken || Date.now() > tokenExpiry) {
//         await refreshToken();
//     }
//     return accessToken;
// };




// app.use('/webhook', express.raw({ type: '*/*' }));


// function isValidSignature(signature, rawBody) {
//     const signatureValidationPayload = `${webhookTargetUrl}:${rawBody}`;
//     console.log('Signature validation payload:', signatureValidationPayload);
//     return nacl.sign.detached.verify(
//         Buffer.from(signatureValidationPayload, 'utf8'),
//         Buffer.from(signature, 'base64'),
//         Buffer.from(publicKey, 'base64')
//     );
// }



// // app.post('/webhook', (req, res) => {

// //     const isValidationRequest = req.headers['x-noones-request-challenge'] !== undefined;
// //     if (isValidationRequest) {
// //         const challenge = req.headers['x-noones-request-challenge'];
// //         console.log('Received validation request, challenge:', challenge);
// //         res.setHeader('x-noones-request-challenge', challenge);
// //         res.status(200).end();
// //         return;
// //     }

// //     const signature = req.headers['x-noones-signature'];
// //     const rawBody = req.body.toString('utf8');  // Convert buffer to string

// //     console.log('Received signature:', signature);
// //     console.log('Received raw body:', rawBody);

// //     if (!signature || !isValidSignature(signature, rawBody)) {
// //         console.log('Invalid signature');
// //         return res.status(400).send('Invalid signature');
// //     }

// //     // Handle other webhook events
// //     console.log('Valid webhook received:', req.body);
// //     res.status(200).send('Webhook received');
// // });

// app.post('/webhook', (req, res) => {
//     // Handle validation requests
//     const isValidationRequest = req.headers['x-noones-request-challenge'] !== undefined;
//     if (isValidationRequest) {
//       const challenge = req.headers['x-noones-request-challenge'];
//       console.log('Received validation request, challenge:', challenge);
//       res.setHeader('x-noones-request-challenge', challenge);
//       res.status(200).end();
//       return;
//     }
  
//     // Proceed if not a validation request
//     const signature = req.get('x-noones-signature');
//     if (!signature) {
//       console.warn('No signature');
//       res.status(403).json({ status: 'error', message: 'No signature header' });
//       return;
//     }
  
//     // Ensure body is not empty for signature validation
//     if (!req.body || Object.keys(req.body).length === 0) {
//       console.warn('Empty body');
//       res.status(400).json({ status: 'error', message: 'Empty body' });
//       return;
//     }
  
//     const rawBody = JSON.stringify(req.body); // Convert body to string for signature validation
  
//     // Validate signature (assuming isValidSignature is a utility function)
//     if (!isValidSignature(signature, rawBody)) {
//       console.log('Invalid signature');
//       return res.status(400).send('Invalid signature');
//     }
  
//     // Handle valid webhook events
//     console.log('Valid webhook received:', req.body);
//     res.status(200).send('Webhook received');
//   });
  

// app.listen(port, () => {
//     console.log(`Server is listening on port ${port}`);
// });




const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const querystring = require('querystring');
const nacl = require('tweetnacl');

const app = express();
const port = 3000;

const publicKey = 'fvcYFZlQl21obFbW5+RK2/foq8JzK/Y5fCEqg+NEy+k=';  // Updated public key
const webhookTargetUrl = 'https://b-backend-xe8q.onrender.com';

let accessToken = null;
let tokenExpiry = 0;

app.use(function(req, res, next) {
    req.rawBody = '';

    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });

    req.on('end', function() {
        req.rawBody = Buffer.from(req.rawBody, 'utf8').toString();
        next();
    });
});


const getAccessToken = async () => {
    const tokenEndpoint = 'https://auth.noones.com/oauth2/token';
    const clientId = 'jiL7JmBC7AZt7KIBx6ngzDhMcFY29Afcq1siKtVbjnjPHvSV';
    const clientSecret = 'qzhw1I1uEmyK0ORKRU3XRnn7F2ENCOHYAxukdDge8AUJoXYP';

    try {
        const response = await axios.post(tokenEndpoint, querystring.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        return response.data;
    } catch (error) {
        console.error('Error getting access token:', error.response ? error.response.data : error.message);
        throw error;
    }
};

const refreshToken = async () => {
    const tokenData = await getAccessToken();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + tokenData.expires_in * 1000;
};

const getValidAccessToken = async () => {
    if (!accessToken || Date.now() > tokenExpiry) {
        await refreshToken();
    }
    return accessToken;
};


// Signature validation function
const isValidSignature = (signature, rawBody) => {
    const message = `${webhookTargetUrl}:${rawBody}`;
    console.log('Signature validation payload:', message);

    return nacl.sign.detached.verify(
        Buffer.from(message, 'utf8'),
        Buffer.from(signature, 'base64'),
        Buffer.from(publicKey, 'base64')
    );
};

// Webhook endpoint
app.post('/webhook', (req, res) => {
    // Handle validation requests
    const isValidationRequest = req.headers['x-noones-request-challenge'] !== undefined;
    if (isValidationRequest) {
        const challenge = req.headers['x-noones-request-challenge'];
        console.log('Received validation request, challenge:', challenge);
        res.setHeader('x-noones-request-challenge', challenge);
        res.status(200).end();
        return;
    }

    // Proceed if not a validation request
    const signature = req.get('x-noones-signature');
    if (!signature) {
        console.warn('No signature');
        return res.status(403).json({ status: 'error', message: 'No signature header' });
    }

    // Ensure body is not empty for signature validation
    if (!req.rawBody || req.rawBody.trim() === '') {
        console.warn('Empty body');
        return res.status(400).json({ status: 'error', message: 'Empty body' });
    }

    // Validate signature
    if (!isValidSignature(signature, req.rawBody)) {
        console.warn('Invalid signature');
        return res.status(400).send('Invalid signature');
    }

    // Handle valid webhook events
    console.debug('Valid webhook received:', req.body);
    res.status(200).send('Webhook received');
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
