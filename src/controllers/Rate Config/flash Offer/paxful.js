const axios = require('axios');
const querystring = require('querystring');

// List of accounts with clientId, clientSecret, and username

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

// Function to get Paxful access token
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

// Function to fetch offers for all accounts

exports.getMultiplePaxfulOffers = async (req, res) => {
    const allOffers = [];

    try {
        // Loop through each account and fetch the offers
        for (const account of accounts) {
            const { clientId, clientSecret, username } = account;

            const token = await getPaxfulToken(clientId, clientSecret);

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

            // Push the offers along with the username for reference
            allOffers.push({
                username,
                offers: response.data
            });
        }

        // Return all the offers for all accounts
        res.status(200).json(allOffers);
        console.log(allOffers);
    } catch (error) {
        console.error('Error fetching Paxful offers for multiple accounts:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};
