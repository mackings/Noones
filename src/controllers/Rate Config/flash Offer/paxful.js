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
    console.log(`Requesting token for client: ${clientId}`);

    const response = await axios.post(tokenEndpoint, querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log(`Token received for client: ${clientId}`);
    return response.data.access_token;
};

// Function to get offers for all accounts
const getOffersForAllAccounts = async () => {
    const allOffers = [];

    for (const account of accounts) {
        const { clientId, clientSecret, username } = account;

        // Get the token for the current account
        console.log(`Fetching token for account: ${username}`);
        const token = await getPaxfulToken(clientId, clientSecret);

        // Fetch the offers for this account
        console.log(`Fetching offers for account: ${username}`);
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

        // Log the number of offers fetched
        console.log(`Fetched ${response.data.data.offers.length} offers for account: ${username}`);

        // Store the offers with the account's credentials for reference
        allOffers.push({
            username,
            clientId,
            clientSecret,
            offers: response.data.data.offers
        });
    }

    console.log('Finished fetching offers for all accounts.');
    return allOffers;
};

// Function to get the current margin of an offer
const getOfferDetails = async (offer_hash, token) => {
    console.log(`Fetching details for offer: ${offer_hash}`);
    const response = await axios.post(
        'https://api.paxful.com/paxful/v1/offer/details',
        querystring.stringify({ offer_hash }),
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );

    const currentMargin = response.data.data.offer.margin; // Assuming margin is in `offer` object
    console.log(`Current margin for offer ${offer_hash}: ${currentMargin}`);
    return currentMargin;
};

// Function to update prices for all offers of all accounts
exports.updatePricesForAllAccounts = async (req, res) => {
    const { margin } = req.body; // Now, only margin is required
    const updateResults = [];

    try {
        // Step 1: Fetch all offers
        console.log('Fetching offers for all accounts...');
        const allOffers = await getOffersForAllAccounts();
        console.log('Offers fetched successfully.');

        // Step 2: Loop through the offers and update the price for each offer
        for (const accountOffers of allOffers) {
            const { username, clientId, clientSecret, offers } = accountOffers;

            for (const offer of offers) {
                const offer_hash = offer.offer_hash; // Extract offer_hash from each offer
                console.log(`Processing offer: ${offer_hash} for account: ${username}`);

                // Get the token again before updating the price for each account
                const token = await getPaxfulToken(clientId, clientSecret);

                // Step 3: Fetch the current margin
                const currentMargin = await getOfferDetails(offer_hash, token);

                // Log the current and new margins
                console.log(`Current margin: ${currentMargin}%, New margin: ${margin}% for offer: ${offer_hash}`);

                // Step 4: Update the price for each offer
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

                // Log the update response for each offer
                console.log(`Price updated for offer: ${offer_hash} (account: ${username}). Response:`, response.data);

                // Store the result of the update
                updateResults.push({
                    username,
                    offer_hash,
                    currentMargin,
                    newMargin: margin,
                    result: response.data
                });
            }
        }

        console.log('Price updates completed for all offers.');
        // Send all results back to the client
        res.status(200).json({ updateResults });

    } catch (error) {
        console.error('Error updating prices for all accounts:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
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


