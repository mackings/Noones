const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const querystring = require('querystring');
const nacl = require('tweetnacl');
const qs = require('qs');
const app = express();



const getAccessToken = async () => {
    const tokenEndpoint = 'https://auth.noones.com/oauth2/token';
    const clientId = 'xQpyqheZ9o0hmPlGmUbazV5VWY1Cv63qXVhZy450IN11bgvR';
    const clientSecret = '9R77pmoW58eJ2ZoVpWndDfdmLjDqQbfQ1UNa4DjGbqtpL0vp';

    try {
        const response = await axios.post(tokenEndpoint, querystring.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error getting access token:', error.response ? error.response.data : error.message);
        throw error;
    }
};



app.post('/update-price', async (req, res) => {
    const { offer_hash, margin } = req.body;

    try {
        const token = await getAccessToken();
        const response = await axios.post(
            'https://api.noones.com/noones/v1/offer/update-price',
            querystring.stringify({ offer_hash, margin }),
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error updating offer price:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
});