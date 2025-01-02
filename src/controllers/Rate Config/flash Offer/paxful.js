const axios = require('axios');
const querystring = require('querystring');

// List of accounts with clientId, clientSecret, and username


const accounts = [

    {
        clientId: 'E53VOgIDNN7bOglY12HrSSTZMrf33pFI6lDSVBkQmaLNVz11',
        clientSecret: 'EmfnR8buyg2N9ILhGWtm1MDOzItRpFV3sbmBftdklIM480tn',
        username: 'boompay'
    },
    
    
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




const tokens = {};

// Function to get the token for a specific account (checks expiration)

const getTokenForAccount = async (username) => {
    const account = accounts.find(acc => acc.username === username);
    if (!account) {
        throw new Error('Account not found');
    }

    // Check if token is stored and valid (expires in 5 hours)
    const now = Date.now();
    if (tokens[username] && tokens[username].expiry > now) {
        return tokens[username].token;
    }

    // Token is either not present or expired, so generate a new one
    const token = await getPaxfulToken(account.clientId, account.clientSecret);
    tokens[username] = {
        token,
        expiry: now + 5 * 60 * 60 * 1000 // Token expiry set to 5 hours
    };

    return token;
};



exports.checkPaxfulTrade = async (req, res) => {

    const { trade_hash, username } = req.body;

    if (!trade_hash || !username) {
        return res.status(400).json({ error: 'trade_hash and username are required in the request body.' });
    }

    try {

        console.log(`Checking trade ${trade_hash} for user ${username}`);
        const token = await getTokenForAccount(username);

        // Prepare the API call to check trade status
        const apiEndpoint = 'https://api.paxful.com/paxful/v1/trade/get';
        const requestBody = querystring.stringify({ trade_hash });

        const response = await axios.post(apiEndpoint, requestBody, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const tradeData = response.data.data.trade;

        if (!tradeData) {
            return res.status(404).json({ error: 'Trade not found.' });
        }

        const { trade_status } = tradeData;

        let message;
        if (trade_status === 'Paid') {
            message = `Trade ${trade_hash} has been marked as paid.`;
        } else {
            message = `Trade ${trade_hash} is currently in status: ${trade_status}.`;
        }

        console.log(`Trade ${trade_hash} status retrieved successfully for ${username}: ${trade_status}`);

        return res.status(200).json({
            message,
            trade_status,
           // trade_details: tradeData,
        });
    } catch (error) {
        console.error(`Error retrieving status for trade ${trade_hash} for ${username}:`, error.response ? error.response.data : error.message);
        return res.status(500).json({
            error: 'Failed to retrieve trade status.',
            details: error.response ? error.response.data : error.message,
        });
    }
};



// Function to mark the trade as paid for Paxful account

exports.markPaxfulTradeAsPaid = async (req, res) => {

    const { trade_hash, username } = req.body;

    if (!trade_hash || !username) {
        return res.status(400).json({ error: 'trade_hash and username are required in the request body.' });
    }

    try {

        console.log(`Processing trade ${trade_hash} for user ${username}`);
        const token = await getTokenForAccount(username);
        const apiEndpoint = 'https://api.paxful.com/paxful/v1/trade/paid';
        const requestBody = querystring.stringify({ trade_hash });

        const response = await axios.post(apiEndpoint, requestBody, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        console.log(`Trade ${trade_hash} marked as paid successfully for ${username}.`);
        return res.status(200).json({
            message: `Trade ${trade_hash} marked as paid successfully.`,
            data: response.data,
        });
    } catch (error) {
        console.error(`Error marking trade ${trade_hash} as paid for ${username}:`, error.response ? error.response.data : error.message);
        return res.status(500).json({
            error: 'Failed to mark trade as paid.',
            details: error.response ? error.response.data : error.message,
        });
    }
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




