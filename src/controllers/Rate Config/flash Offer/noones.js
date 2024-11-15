const axios = require('axios');
const querystring = require('querystring');
const cron = require('node-cron');

// {
//     clientId: 'xQpyqheZ9o0hmPlGmUbazV5VWY1Cv63qXVhZy450IN11bgvR',
//     clientSecret: '9R77pmoW58eJ2ZoVpWndDfdmLjDqQbfQ1UNa4DjGbqtpL0vp',
//     username: 'Eden_Ageh'
// },


const accounts = [

    {
        clientId: 'PU6fKlhQgBZXudAT2zAMpWRkd8ntAAPQ3pW6P4ixY7l9lfsH',
        clientSecret: 'I5GWUA6IBBwSl334bI1IvvPJ3FTWuQwwzICitC19X4cDn158',
        username: '2minmax_pro'
    },

    {
        clientId: 'V113ijGnugBUJ9dkUQoXCKDde8LabWpSlWdEboIauM5q2HKr',
        clientSecret: 'ZwmMrn1bGT0Gi6bVzgZyZsLaRwpdMbr4eBFuUb7JLTAGg8O3',
        username: '2minutepay'
    },

    {
        clientId: '98kD06ZuQteA708v8yNppjcBFhqiRYrvbsc7gRc2h8ll4fzZ',
        clientSecret: 'FkV3V72y7e7jwrvSH7BE8OUiTAkY5gVfPXxYlULPuKDwALJX',
        username: 'Turbopay'
    },

    {
        clientId: 'T7SlJXd6JEMYXvsx4JK9ofXzGQp3VQIFsnCK0z2qd04jEBZg',
        clientSecret: 'EacevKvHlWSGotRFf6I1Nl5KqJYkCtSLiji5PVuVONrjLbW8',
        username: '2fastpay'
    },

];


const getnoonesToken = async (clientId, clientSecret) => {
    const tokenEndpoint = 'https://auth.noones.com/oauth2/token';
    console.log(`Requesting token for client: ${clientId}`);

    const response = await axios.post(tokenEndpoint, querystring.stringify({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log(`Token received for client: ${clientId}`);
    console.log(response.data.access_token);
    return response.data.access_token;
};




exports.getNoonesWebhooksForAllAccounts = async (req, res) => {
    const webhookUrl = 'https://api.noones.com/webhook/v1/user/webhooks';
    const getResults = [];

    try {
        for (const account of accounts) {
            const { username, clientId, clientSecret } = account;

            // Get access token for the account
            try {
                const token = await getnoonesToken(clientId, clientSecret);

                console.log(`Fetching webhooks for account: ${username}`);

                // Send GET request to retrieve webhooks
                try {
                    const response = await axios.get(webhookUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`Fetched webhooks for account: ${username}. Response:`, response.data);

                    // Store the result of the retrieval
                    getResults.push({
                        username,
                        webhooks: response.data
                    });
                } catch (getError) {
                    console.error(`Error fetching webhooks for account: ${username}. Error:`, getError.message);
                    getResults.push({
                        username,
                        error: getError.message
                    });
                }

            } catch (tokenError) {
                console.error(`Error fetching token for account: ${username}. Error:`, tokenError.message);
                getResults.push({
                    username,
                    error: tokenError.message
                });
            }
        }

        console.log('Webhook retrieval completed for all accounts.');
        res.status(200).json({ getResults });

    } catch (error) {
        console.error('Error retrieving webhooks for all accounts:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};



const updateNoonesWebhooksForAllAccounts = async () => {
    const webhookUrl = 'https://api.noones.com/webhook/v1/user/webhooks';
    const updateResults = [];

    try {
        for (const account of accounts) {
            const { username, clientId, clientSecret } = account;

            try {
                const token = await getnoonesToken(clientId, clientSecret);

                console.log(`Checking webhooks for account: ${username}`);

                const response = await axios.get(webhookUrl, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                const webhooks = response.data;
                let requiresUpdate = false;

                if (!webhooks.length) {
                    requiresUpdate = true;
                } else {
                    for (const webhook of webhooks) {
                        if (webhook.endpoints.some(endpoint => !endpoint.enabled)) {
                            requiresUpdate = true;
                            break;
                        }
                    }
                }

                if (requiresUpdate) {
                    console.log(`Updating webhooks for account: ${username}`);

                    // Delete existing webhooks
                    await axios.delete(webhookUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`Re-creating webhooks for account: ${username}`);

                    const requestBody = {
                        tag: "string",
                        endpoints: [
                            {
                                event_type: "trade.started",
                                url: "https://noones-v1.onrender.com/webhook",
                                enabled: true
                            },
                            {
                                event_type: "trade.chat_message_received",
                                url: "https://noones-v1.onrender.com/webhook",
                                enabled: true
                            }
                        ]
                    };

                    const createResponse = await axios.post(webhookUrl, requestBody, {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    updateResults.push({ username, result: createResponse.data });
                } else {
                    updateResults.push({ username, message: "No updates required" });
                }
            } catch (error) {
                updateResults.push({ username, error: error.message });
            }
        }

        console.log('Update results:', updateResults);
    } catch (error) {
        console.error('Error during updates:', error.message);
    }
};

// Schedule the task to run every 5 minutes
cron.schedule('*/5 * * * *', () => {
    console.log('Running Automatic webhook updater...>>>>>>>>');
    updateNoonesWebhooksForAllAccounts();
});




const getnoonesOffersForAllAccounts = async () => {
    const allOffers = [];

    for (const account of accounts) {
        const { clientId, clientSecret, username } = account;

        // Get the token for the current account
        console.log(`Fetching token for account: ${username}`);
        const token = await getnoonesToken(clientId, clientSecret);

        // Fetch the offers for this account
        console.log(`Fetching offers for account: ${username}`);
        const response = await axios.post(
            'https://api.noones.com/noones/v1/offer/list',
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



exports.updatenoonesPricesForAllAccounts = async (req, res) => {
    const { margin } = req.body; 
    const updateResults = [];

    try {

        console.log('Fetching offers for all accounts...');
        const allOffers = await getnoonesOffersForAllAccounts();
        console.log('Offers fetched successfully.');

        for (const accountOffers of allOffers) {
            const { username, clientId, clientSecret, offers } = accountOffers;

            for (const offer of offers) {
                const offer_hash = offer.offer_hash; 
                const currentMargin = offer.margin;  
                
                console.log(`Processing offer: ${offer_hash} for account: ${username}`);
                console.log(`Current margin: ${currentMargin}% for offer: ${offer_hash}`);

                try {
                    const token = await getnoonesToken(clientId, clientSecret);
                    console.log(`Updating margin from ${currentMargin}% to ${margin}% for offer: ${offer_hash}`);

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




exports.getMultiplenoonesOffers = async (req, res) => {

    const allOffers = [];

    try {
        // Loop through each account and fetch the offers
        for (const account of accounts) {
            const { clientId, clientSecret, username } = account;

            const token = await getnoonesToken(clientId, clientSecret);

            const response = await axios.post(
                'https://api.noones.com/noones/v1/offer/list',
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
        console.log("Returning offers for Noones");
        console.log(allOffers);
    } catch (error) {
        console.error('Error fetching Paxful offers for multiple accounts:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};




exports.updatenoonesOffersForSpecificAccount = async (req, res) => {

    const { username, margin } = req.body;
    const updateResults = [];

    try {
        const account = accounts.find(acc => acc.username === username);
        if (!account) {
            return res.status(404).json({ error: `Account with username "${username}" not found.` });
        }

        const { clientId, clientSecret } = account;

        // Step 2: Fetch offers for this specific account
        console.log(`Fetching token for account: ${username}`);
        const token = await getnoonesToken(clientId, clientSecret);

        console.log(`Fetching offers for account: ${username}`);
        const response = await axios.post(
            'https://api.noones.com/noones/v1/offer/list',
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
                const token = await getnoonesToken(clientId, clientSecret);

                console.log(`Updating margin from ${currentMargin}% to ${margin}% for offer: ${offer_hash}`);
                
                const updateResponse = await axios.post(
                    'https://api.noones.com/noones/v1/offer/update-price',
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

                updateResults.push({
                    username,
                    offer_hash,
                    currentMargin,
                    newMargin: updatedMargin, 
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





