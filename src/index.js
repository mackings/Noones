const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const querystring = require('querystring');
const nacl = require('tweetnacl');

const app = express();
const port = 3000;
//const publicKey = 'fvcYFZlQl21obFbW5+RK2/foq8JzK/Y5fCEqg+NEy+k=';
const publicKey = "dwRTVx5ksV2UXq1JGZEusw0vTDcxdkmi4H53xiyfDmBYYuqo"
const webhookTargetUrl = 'https://b-backend-xe8q.onrender.com';

let accessToken = null;
let tokenExpiry = 0;

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

app.use(bodyParser.json());
app.use(function(req, res, next) {
    req.rawBody = '';
    req.on('data', function(chunk) {
        req.rawBody += chunk;
    });
    next();
});


function isValidSignature(signature, rawBody) {
    const signatureValidationPayload = `${webhookTargetUrl}:${rawBody}`;
    console.log(signatureValidationPayload);
    return nacl.sign.detached.verify(
        Buffer.from(signatureValidationPayload, 'utf8'),
        Buffer.from(signature, 'base64'),
        Buffer.from(publicKey, 'base64')
    );
}

app.post('/webhook', (req, res) => {
    const isValidationRequest = req.headers['x-noones-request-challenge'] !== undefined;
    if (isValidationRequest) {
        const challenge = req.headers['x-noones-request-challenge'];
        console.log(challenge);
        res.setHeader('x-noones-request-challenge', challenge);
        res.status(200).end();
        return;
    }

    const signature = req.headers['x-noones-signature'];
    const rawBody = req.rawBody;
    console.log(signature);
    console.log(rawBody);

    if (!signature || !isValidSignature(signature, rawBody)) {
        return res.status(400).send('Invalid signature');
    }

    // Handle other webhook events
    console.log('Valid webhook received:', req.body);
    res.status(200).send('Webhook received');
});

app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
