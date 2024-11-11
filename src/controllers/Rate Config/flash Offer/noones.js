const axios = require('axios');
const querystring = require('querystring');

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
        grant_type: 'client_credentialss',
        client_id: clientId,
        client_secret: clientSecret,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    console.log(`Token received for client: ${clientId}`);
    console.log(response.data.access_token);
    return response.data.access_token;
};



exports.updateNoonesWebhooksForAllAccounts = async (req, res) => {
    const webhookUrl = 'https://api.noones.com/webhook/v1/user/webhooks';
    const updateResults = [];

    // Webhook events to update
    const eventsToUpdate = [
        "trade.started",
        "trade.chat_message_received"
    ];

    try {

        for (const account of accounts) {
            const { username, clientId, clientSecret } = account;

            // Get access token for the account
            try {
                const token = await getnoonesToken(clientId, clientSecret);

                for (const event_type of eventsToUpdate) {
                    console.log(`Updating webhook for event: ${event_type} for account: ${username}`);

                    // Send request to update webhook
                    try {
                        const response = await axios.post(webhookUrl, {
                            endpoints: [
                                {
                                    url: "https://b-backend-xe8q.onrender.com/webhook",
                                    enabled: true,
                                    event_type: event_type
                                }
                            ]
                        }, {
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        });

                        console.log(`Webhook updated for event: ${event_type} (account: ${username}). Response:`, response.data);

                        // Store the result of the update
                        updateResults.push({
                            username,
                            event_type,
                            result: response.data
                        });
                    } catch (updateError) {
                        console.error(`Error updating webhook for event: ${event_type} (account: ${username}). Error:`, updateError.message);
                        updateResults.push({
                            username,
                            event_type,
                            error: updateError.message
                        });
                    }
                }

            } catch (tokenError) {
                console.error(`Error fetching token for account: ${username}. Error:`, tokenError.message);
                updateResults.push({
                    username,
                    error: tokenError.message
                });
            }
        }

        console.log('Webhook updates completed for all accounts.');
        res.status(200).json({ updateResults });

    } catch (error) {
        console.error('Error updating webhooks for all accounts:', error);
        res.status(500).json({ error: error.response ? error.response.data : error.message });
    }
};


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





