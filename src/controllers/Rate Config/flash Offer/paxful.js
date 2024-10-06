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


const getOffersForAllAccounts = async () => {
    const allOffers = [];

    for (const account of accounts) {
        const { clientId, clientSecret, username } = account;

        // Get the token for the current account
        const token = await getPaxfulToken(clientId, clientSecret);

        // Fetch the offers for this account
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

        // Store the offers with the account's username for reference
        allOffers.push({
            username,
            offers: response.data.data.offers // Assuming `offers` is under `data.offers` in response
        });
    }

    return allOffers;
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





exports.updatePricesForAllAccounts = async (req, res) => {
    const { margin } = req.body; // Now, only margin is required
    const updateResults = [];

    try {
        // Step 1: Fetch all offers
        const allOffers = await getOffersForAllAccounts();

        // Step 2: Loop through the offers and update the price for each offer
        for (const accountOffers of allOffers) {
            const { username, offers } = accountOffers;
            
            for (const offer of offers) {
                const offer_hash = offer.offer_hash; // Extract offer_hash from each offer

                const token = await getPaxfulToken(accountOffers.clientId, accountOffers.clientSecret);

                // Step 3: Update the price for each offer
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

                // Store the result of the update
                updateResults.push({
                    username,
                    offer_hash,
                    result: response.data
                });
            }
        }

        // Send all results back to the client
        res.status(200).json({ updateResults });

    } catch (error) {
        console.error('Error updating prices for all accounts:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};

