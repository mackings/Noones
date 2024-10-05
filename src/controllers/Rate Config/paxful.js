const axios = require('axios');
const querystring = require('querystring');

// Function to get Paxful access token
const getPaxfulToken = async () => {

    const tokenEndpoint = 'https://accounts.paxful.com/oauth2/token';

    const clientId =     '2HATIKk9764Vw2u2OQOOe1Q8vh6vEUom3piooipCQQKOsiP5';  
    const clientSecret = 'v5gaTp66t8HgEfgNYlUTnzgu1To3f6nEwGqpSvRTfsuWewp6';

    const response = await axios.post(tokenEndpoint, querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data.access_token;
};

// Function to update Paxful price
exports.updatePaxfulPrice = async (req, res) => {

    const { offer_hash, margin } = req.body;
    try {
        const token = await getPaxfulToken();
        const response = await axios.post(
            'https://api.paxful.com/paxful/v1/offer/update-price',
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
        console.error('Error updating Paxful price:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};

// Function to get Paxful user info

exports.getPaxfulUserInfo = async (req, res) => {
    try {
        const token = await getPaxfulToken();
        const response = await axios.post(
            'https://api.paxful.com/paxful/v1/user/info',
            querystring.stringify({ username: req.body.username }),
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching Paxful user info:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};
