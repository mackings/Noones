const axios = require('axios');
const querystring = require('querystring');

// List of accounts with clientId, clientSecret, and username

const accounts = [
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

    {
        clientId: 'Uf4lf48TlgAxN5bYuNU2iQd3MsWBuMiKJ2GFIyqkN1RNKRpd',
        clientSecret: '8Bkc9hqlQBoeNrtXEIFmxyu2WZQXpWgoEOvQcOtbtJUuFA6u',
        username: '2fastpay'
    },

    {
        clientId: '9Q0ICEOoQpYOnmiTcCfCXGH4yGfDahek9Uhs8wrqcsvbsac7',
        clientSecret: 'jTkrp79rpOG5AHxyLfCimO4bMtx43yXrLuAHLBgkwuF9vIZE',
        username: '2minutepay'
    },

    {
        clientId: 'AbgnZQxyIM259CZ7RLxibzFyeUvNsaBs26UffEP4IcNSpHD9',
        clientSecret: 'wmM4TrNmi125zGwuAb4i7jXmS7qIG9DLKaQRPOTU604v5aBF',
        username: '2minmax_pro'
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



// Function to update prices for all offers across all accounts

exports.updatePricesForAllAccounts = async (req, res) => {
    const { margin } = req.body; // New margin to be applied
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
                const currentMargin = offer.margin;  // Extract the current margin from the offer
                
                console.log(`Processing offer: ${offer_hash} for account: ${username}`);
                console.log(`Current margin: ${currentMargin}% for offer: ${offer_hash}`);

                // Get the token again before updating the price for each account
                try {
                    const token = await getPaxfulToken(clientId, clientSecret);

                    // Log the current and new margins
                    console.log(`Updating margin from ${currentMargin}% to ${margin}% for offer: ${offer_hash}`);

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

                    // After successful update, log the details
                    const updatedMargin = response.data.data.updated_margin; // Adjust this based on the actual API response structure
                    console.log(`Price updated for offer: ${offer_hash} (account: ${username}). Response:`, response.data);
                    console.log(`Updated Margin: ${updatedMargin}% | Previous Margin: ${currentMargin}% | Margin Sent for Update: ${margin}%`);

                    // Store the result of the update
                    updateResults.push({
                        username,
                        offer_hash,
                        currentMargin,
                        newMargin: updatedMargin, // Store updated margin
                        sentMargin: margin, // Store sent margin
                        result: response.data
                    });
                } catch (updateError) {
                    console.error(`Error updating price for offer: ${offer_hash} (account: ${username}). Error:`, updateError.message);
                    // Log failure for individual offer update
                    updateResults.push({
                        username,
                        offer_hash,
                        currentMargin,
                        newMargin: null,
                        sentMargin: margin,
                        error: updateError.message
                    });
                }
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



// Endpoint to update offers for a specific account
// Function to update offers for a specific account

exports.updateOffersForSpecificAccount = async (req, res) => {
    const { username, margin } = req.body; // username and new margin to be applied

    const updateResults = [];

    try {
        // Step 1: Find the account by username
        const account = accounts.find(acc => acc.username === username);
        if (!account) {
            return res.status(404).json({ error: `Account with username "${username}" not found.` });
        }

        const { clientId, clientSecret } = account;

        // Step 2: Fetch offers for this specific account
        console.log(`Fetching token for account: ${username}`);
        const token = await getPaxfulToken(clientId, clientSecret);

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

        const offers = response.data.data.offers;
        console.log(`Fetched ${offers.length} offers for account: ${username}`);

        // Step 3: Loop through each offer and update the price
        for (const offer of offers) {
            const offer_hash = offer.offer_hash;
            const currentMargin = offer.margin;

            console.log(`Processing offer: ${offer_hash} for account: ${username}`);
            console.log(`Current margin: ${currentMargin}% for offer: ${offer_hash}`);

            try {
                const token = await getPaxfulToken(clientId, clientSecret);

                console.log(`Updating margin from ${currentMargin}% to ${margin}% for offer: ${offer_hash}`);
                
                const updateResponse = await axios.post(
                    'https://api.paxful.com/paxful/v1/offer/update-price',
                    querystring.stringify({ offer_hash, margin }),
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    }
                );

                // Check if 'updated_margin' exists in the response data
                const updatedMargin = updateResponse.data.data?.updated_margin || null; // Use null if undefined
                console.log(`Price updated for offer: ${offer_hash} (account: ${username}). Response:`, updateResponse.data);

                // Store the result of the update
                updateResults.push({
                    username,
                    offer_hash,
                    currentMargin,
                    newMargin: updatedMargin, // Use updatedMargin which may be null if not present
                    sentMargin: margin,
                    result: updateResponse.data
                });
            } catch (updateError) {
                console.error(`Error updating price for offer: ${offer_hash} (account: ${username}). Error:`, updateError.message);
                updateResults.push({
                    username,
                    offer_hash,
                    currentMargin,
                    newMargin: null,
                    sentMargin: margin,
                    error: updateError.message
                });
            }
        }

        console.log('Price updates completed for all offers of the account.');
        // Return the update results
        res.status(200).json({ updateResults });

    } catch (error) {
        console.error('Error updating prices for the account:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};




