const axios = require('axios');
const querystring = require('querystring');

// Define clientId and clientSecret as constants
const clientId = "2HATIKk9764Vw2u2OQOOe1Q8vh6vEUom3piooipCQQKOsiP5";
const clientSecret = "v5gaTp66t8HgEfgNYlUTnzgu1To3f6nEwGqpSvRTfsuWewp6";


const getPaxfulToken = async () => {

    const tokenEndpoint = 'https://accounts.paxful.com/oauth2/token';

    const response = await axios.post(tokenEndpoint, querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,  // Pass the clientId here
        client_secret: clientSecret,  // Pass the clientSecret here
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data.access_token;
};



exports.getPaxfulOffers = async (req, res) => {
    
    try {
        const token = await getPaxfulToken();
        const response = await axios.post(
            'https://api.paxful.com/paxful/v1/offer/list',
            querystring.stringify({ 
                active: true,
                offer_type: "buy"
            }),
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
