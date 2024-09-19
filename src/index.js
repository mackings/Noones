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

    next();
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
const isValidSignature = (signature, host, originalUrl, rawBody) => {
    const message = `https://${host}${originalUrl}:${rawBody}`;
    return nacl.sign.detached.verify(
        Buffer.from(message, 'utf8'),
        Buffer.from(signature, 'base64'),
        Buffer.from(publicKey, 'base64') // TODdOss consider adding it as a constant?
    )
}

// Webhook endpoint
app.post('/webhook', (req, res) => {

    // Handle validation requests
    res.set('x-noones-request-challenge', req.headers['x-noones-request-challenge']);
    console.log('Webhook received with headers:', req.headers);

    const isValidationRequest = req.body === undefined;
    if (isValidationRequest) {
      console.debug('Validation request arrived');
      res.json({ status: 'ok' });
      return;
    }

    const signature = req.get('x-noones-signature');
    console.log("Noones Signature >>", signature);
    if (!signature) {
      console.warn('No signature');
      res.status(403).json({ status: 'error', message: 'No signature header' });
      return;
    }
    console.log('Incoming webhook request body:', req.rawBody);
    if (!req.rawBody || req.rawBody.trim() === '') {
        console.warn('Empty body');
        res.status(400).json({ status: 'error', message: 'Empty body' });
        return;
    }

    if (!isValidSignature(signature, req.get('host'), req.originalUrl, req.rawBody)) {
      console.warn('Invalid signature');
      res.status(403).json({ status: 'error', message: 'Invalid signature' });
      return;
    }

    //console.debug('\n---------------------');
    console.debug('New incoming webhook >>>>');
    console.debug(req.body);
    //console.debug('---------------------');

    // Handle valid webhook events
    console.debug('Valid webhook received:', req.body);
    res.status(200).send('Webhook received');
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});