const axios = require('axios');
const querystring = require('querystring');

// Function to get Paxful access token


const accounts = [

    {
        clientId: '2HATIKk9764Vw2u2OQOOe1Q8vh6vEUom3piooipCQQKOsiP5',
        clientSecret: 'v5gaTp66t8HgEfgNYlUTnzgu1To3f6nEwGqpSvRTfsuWewp6',
        username: 'MeekWhistler588'
    },


    {
        clientId: 'vO6rxHCcGSpvy8EfcbyoDLjnC24HHpKQwkEj0PmWhMKl0zoP',
        clientSecret: 'og1wEN1ffZZ33K3D6XMenjSM7B6pIDJn2ahB2aPojXRsGf1B',
        username: 'donviky19'
    },

    {
        clientId: 'AEbsdy63Z21LwWQaB00rmY2hE4sHX792zekkfH6SnjnF1SsT',
        clientSecret: '9wSG2iMUEwTrpExTtoq5N4TZ6ElQVvmukKSgSRJ57twGvMZd',
        username: 'Turbopay'
    },

    // Add more accounts as needed
];



const getPaxfulTokens = async (clientId, clientSecret) => {
    const tokenEndpoint = 'https://accounts.paxful.com/oauth2/token';

    const response = await axios.post(tokenEndpoint, querystring.stringify({
        grant_type: 'client_credentials',
        client_id: id,
        client_secret: secret,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data.access_token;
};


const getPaxfulToken = async (clientId, clientSecret) => {
    const tokenEndpoint = 'https://accounts.paxful.com/oauth2/token';

    const response = await axios.post(tokenEndpoint, querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data.access_token;
};




exports.getMultiplePaxfulUserInfo = async (req, res) => {

    const accountDetails = [];

    try {
        // Loop through each account and fetch the user info

        for (const account of accounts) {
            const { clientId, clientSecret, username } = account;

            const token = await getPaxfulToken(clientId, clientSecret);

            const response = await axios.post(
                'https://api.paxful.com/paxful/v1/user/info',
                querystring.stringify({ username }),
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            accountDetails.push({
                username,
                data: response.data
            });
        }

        // Return all account details
        res.status(200).json(accountDetails);
        console.log(accountDetails);
    } catch (error) {
        console.error('Error fetching multiple Paxful user info:', error);
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



exports.updatePaxfulPrice = async (req, res) => {

    const { offer_hash, margin } = req.body;
    try {
        const token = await getPaxfulTokens();
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
