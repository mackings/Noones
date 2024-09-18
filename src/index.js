const express = require('express');
const bodyParser = require('body-parser');
const axios = require("axios");
const querystring = require('querystring');
const nacl = require('tweetnacl'); // Ensure you have this package installed

const app = express();
const port = 3000; // Set your desired port

let accessToken = null;
let tokenExpiry = 0;


//const publicKey = 'jiL7JmBC7AZt7KIBx6ngzDhMcFY29Afcq1siKtVbjnjPHvSV';
//const publicKey = " hd9MdXk5tBtgjE242eh9zgkeNP0Ho2vO";

const publicKey = 'fvcYFZlQl21obFbW5+RK2/foq8JzK/Y5fCEqg+NEy+k=';
const webhookTargetUrl = 'https://b-backend-xe8q.onrender.com'; 


// Function to get access token
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
        console.log(error);
        console.error('Error getting access token:', error.response ? error.response.data : error.message);
        throw error;
    }
};


// Refresh the access token
const refreshToken = async () => {
    const tokenData = await getAccessToken();
    accessToken = tokenData.access_token;
    tokenExpiry = Date.now() + tokenData.expires_in * 1000;
};

//  function to get a valid access token

const getValidAccessToken = async () => {
    if (!accessToken || Date.now() > tokenExpiry) {
        await refreshToken();
    }
    return accessToken;
};

// Middleware to parse raw body for webhook signature validation

app.use(bodyParser.json());
app.use(function(req, res, next) {
    req.rawBody = '';

    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });

    next();
});



function isValidSignature(signature, host, originalUrl, rawBody) {
    const message = `${webhookTargetUrl}:${rawBody}`;
    return nacl.sign.detached.verify(
        Buffer.from(message, 'utf8'),
        Buffer.from(signature, 'base64'),
        Buffer.from(publicKey, 'base64')
    );
}


app.post('/webhook', async (req, res) => {

    const isValidationRequest = req.body.type === undefined;
    if (isValidationRequest) {
        res.set("X-NoOnes-Request-Challenge", req.headers['x-noones-request-challenge']);

        return;
    }
    // const providedSignature = req.get('X-Noones-Signature');
    // if (!providedSignature) {
    //     console.log('No signature provided.');
    //     return res.status(403).json({ status: 'error', message: 'No signature header' });
    // }

    // if (!isValidSignature(providedSignature, req.get('host'), req.originalUrl, req.rawBody)) {
    //     console.log('Invalid signature');
    //     return res.status(403).json({ status: 'error', message: 'Invalid signature' });
    // }

    console.debug('Webhook event received:', req.body);

});






// Middleware to validate webhook signature

// app.use((req, res, next) => {
//     const providedSignature = req.get('X-Noones-Signature');
//     if (!providedSignature) {
//         console.log('No signature provided.');
//         return res.status(403).send('No signature provided');
//     }

//     const signatureValidationPayload = `${webhookTargetUrl}:${req.rawBody}`;
//     const isValidSignature = nacl.sign.detached.verify(
//         Buffer.from(signatureValidationPayload, 'utf8'),
//         Buffer.from(providedSignature, 'base64'),
//         Buffer.from(publicKey, 'base64')
//     );

//     // Log for debugging
//     console.log('Provided Signature:', providedSignature);
//     console.log('Signature Validation Payload:', signatureValidationPayload);

//     if (!isValidSignature) {
//         console.log('Signature validation failed.');
//         return res.status(403).send('Invalid signature');
//     }

//     console.log('Signature validation passed.');
//     next();
// });



// // Middleware to handle webhook validation request

// app.post('/webhook', (req, res) => {
//     if (!Object.keys(req.body).length && req.get('X-Noones-Request-Challenge')) {
//         res.set('X-Noones-Request-Challenge', req.get('X-Noones-Request-Challenge'));
//         res.status(200).end();
//     } else {
//         console.log('Webhook event received:', req.body);
//         res.status(200).end();
//     }
// });



app.listen(port, () => console.log(`App listening at http://localhost:${port}`));

const useAccessToken = async () => {

    try {
        const token = await getValidAccessToken();
        console.log('Access token:', token);

        // Example API call using the access token
        const response = await axios.get('https://api.noones.com/noones/v1/user/info', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('API response:', response.data);
    } catch (error) {
        console.error('Error using access token:', error.response ? error.response.data : error.message);
    }
};

// Call this function when needed to use the access token
useAccessToken();
