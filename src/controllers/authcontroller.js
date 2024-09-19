const axios = require('axios');
const querystring = require('querystring');
const qs = require('qs');

const getRatesToken = async () => {
    const tokenEndpoint = 'https://auth.noones.com/oauth2/token';
    const clientId = 'xQpyqheZ9o0hmPlGmUbazV5VWY1Cv63qXVhZy450IN11bgvR';
    const clientSecret = '9R77pmoW58eJ2ZoVpWndDfdmLjDqQbfQ1UNa4DjGbqtpL0vp';

    const response = await axios.post(tokenEndpoint, querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data.access_token;
};



const updatePrice = async (req, res) => {
    const { offer_hash, margin } = req.body;
    try {
        const token = await getRatesToken();
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
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};

const useAccessToken = async (req, res) => {
    try {
        const token = await getRatesToken();
        const response = await axios.post(
            'https://api.noones.com/noones/v1/user/info',
            qs.stringify({ username: req.body.username }),
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};

module.exports = { updatePrice, useAccessToken };
