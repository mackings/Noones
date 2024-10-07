const axios = require('axios');
const querystring = require('querystring');

//Don
// const clientId = "vO6rxHCcGSpvy8EfcbyoDLjnC24HHpKQwkEj0PmWhMKl0zoP";
// const clientSecret = "og1wEN1ffZZ33K3D6XMenjSM7B6pIDJn2ahB2aPojXRsGf1B";


//2FASt
const clientId = "Uf4lf48TlgAxN5bYuNU2iQd3MsWBuMiKJ2GFIyqkN1RNKRpd";
const clientSecret = "8Bkc9hqlQBoeNrtXEIFmxyu2WZQXpWgoEOvQcOtbtJUuFA6u";


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



exports.UpdateSingleMargin = async (req, res) => {

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
        console.error('Error updating price:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};
