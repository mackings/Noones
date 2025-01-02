const axios = require('axios');
const querystring = require('querystring');
const cron = require('node-cron');
const dotenv = require('dotenv').config();
const mongoose = require('mongoose');
const { Allstaff, Bank, Inflow } = require("../../Model/staffmodel");
const { serviceAccount } = require("../../webhookcontroller");
const admin = require("firebase-admin");
const ManualUnassigned = require("../../Model/unassignedmodel");




const accounts = [

    {
        clientId: 'Yq0XIIVCnyjYgDKJBUg0Atz37uFKFNAt66r13PnLkGK9cvTI',
        clientSecret: 'o5hICv2hrS8Vmuq2jrOmZj9WwMX4rCWIi6mPscfYCQrH2zyi',
        username: 'boompay'
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

    console.log(`Token Received for client: ${clientId}`);
    console.log(response.data.access_token);
    return response.data.access_token;
};


const tokens = {};

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
    const token = await getnoonesToken(account.clientId, account.clientSecret);
    tokens[username] = {
        token,
        expiry: now + 5 * 60 * 60 * 1000 // Token expiry set to 5 hours
    };

    return token;
};




const offerApi = {
    turnOn: 'https://api.noones.com/noones/v1/offer/turn-on',
    turnOff: 'https://api.noones.com/noones/v1/offer/turn-off'
};

// Shared function to toggle offers (reused by both endpoints)

const toggleOffers = async (endpoint, action) => {
    const results = [];
    for (const account of accounts) {
        const { username } = account;
        try {
            // Get or refresh the token for the account
            const token = await getTokenForAccount(username);

            console.log(`${action} offers for account: ${username}`);

            // Make the POST request to toggle offers
            const response = await axios.post(endpoint, {}, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`${action} offers success for account: ${username}`);

            results.push({
                username,
                status: 'success',
                response: response.data
            });

        } catch (error) {
            console.error(`${action} offers failed for account: ${username}. Error: ${error.message}`);
            results.push({
                username,
                status: 'error',
                error: error.message
            });
        }
    }

    return results;
};



// Endpoint to turn ON offers
exports.turnOnOffersForAllAccounts = async (req, res) => {
    try {
        const results = await toggleOffers(offerApi.turnOn, 'Turn on');
        res.status(200).json({ results });
        console.log(results);
    } catch (error) {

        console.error('Error turning on offers for all accounts:', error);
        res.status(500).json({ error: error.message });
    }
};


// Endpoint to turn OFF offers
exports.turnOffOffersForAllAccounts = async (req, res) => {
    try {
        const results = await toggleOffers(offerApi.turnOff, 'Turn off');
        res.status(200).json({ results });
        console.log(results);
    } catch (error) {
        console.error('Error turning off offers for all accounts:', error);
        res.status(500).json({ error: error.message });
    }
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




const checkWalletBalances = async () => {
    
    const apiEndpoint = 'https://api.noones.com/wallet/v3/summary';
    const balances = {};
    let totalBTC = 0;
    let totalUSDT = 0;

    for (const account of accounts) {
        try {
            console.log(`Checking wallet balances for username: ${account.username}`);
            
            // Get the token for the account
            const token = await getTokenForAccount(account.username);

            // Make the GET request to retrieve wallet summary
            const response = await axios.get(apiEndpoint, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const walletAssets = response.data.assets;
            balances[account.username] = {};

            // Parse the assets for BTC and USDT balances
            ['BTC', 'USDT'].forEach((crypto) => {
                const asset = walletAssets.find((a) => a.currency_code === crypto);
                const balance = parseFloat(asset?.balance || 0);
                balances[account.username][crypto] = balance;

                // Add to total balances
                if (crypto === 'BTC') totalBTC += balance;
                if (crypto === 'USDT') totalUSDT += balance;
            });

            console.log(`Balances for ${account.username}:`, balances[account.username]);
        } catch (error) {
            console.error(`Error retrieving wallet balances for ${account.username}:`, error.response ? error.response.data : error.message);
            balances[account.username] = {
                error: error.response ? error.response.data : error.message,
            };
        }
    }

    // Add total balances to the result
    balances.total = {
        BTC: totalBTC,
        USDT: totalUSDT,
    };

    return balances;
};



exports.checkWalletBalances = async (req, res) => {
    try {
        const balances = await checkWalletBalances();
        return res.status(200).json(balances);
    } catch (error) {
        console.error('Error checking wallet balances:', error.message);
        return res.status(500).json({ error: 'Failed to check wallet balances.', details: error.message });
    }
};





exports.checkNoonesTrade = async (req, res) => {

    const { trade_hash, username } = req.body;

    if (!trade_hash || !username) {
        return res.status(400).json({ error: 'trade_hash and username are required in the request body.' });
    }

    try {
        console.log(`Checking trade ${trade_hash} for user ${username}`);

        // Get the token for the specified username
        const token = await getTokenForAccount(username);

        // Prepare the API call to check trade status
        const apiEndpoint = 'https://api.noones.com/noones/v1/trade/get';
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


// Function to mark the trade as paid for the given username


exports.markTradeAsPaid = async (req, res) => {

    const { trade_hash, username } = req.body;

    if (!trade_hash || !username) {
        return res.status(400).json({ error: 'trade_hash and username are required in the request body.' });
    }

    try {
        console.log(`Processing trade ${trade_hash} for user ${username}`);

        // Get the token for the specified username
        const token = await getTokenForAccount(username);

        // Prepare the API call to mark trade as paid
        const apiEndpoint = 'https://api.noones.com/noones/v1/trade/paid';
        const requestBody = querystring.stringify({ trade_hash });

        const response = await axios.post(apiEndpoint, requestBody, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        console.log(`Trade ${trade_hash} marked as paid successfully for ${username}.`);

        assignUnassignedTrades();

        return res.status(200).json({
            message: `Trade ${trade_hash} marked as paid successfully.`,
            data: response.data,
        });
         
    } catch (error) {
        assignUnassignedTrades();

        console.error(`Error marking trade ${trade_hash} as paid for ${username}:`, error.response ? error.response.data : error.message);
        return res.status(500).json({
            error: 'Failed to mark trade as paid.',
            details: error.response ? error.response.data : error.message,
        });
    }
};



const updateNoonesWebhooksForAllAccounts = async () => {
    
    const webhookUrl = 'https://api.noones.com/webhook/v1/user/webhooks';
    const updateResults = [];

    try {
        for (const account of accounts) {
            const { username } = account;

            try {
                const token = await getTokenForAccount(username);
                console.log(`Checking webhooks for account: ${username}`);

                const response = await axios.get(webhookUrl, {
                    headers: {
                        Authorization: `Bearer ${token}`,
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
                    await axios.delete(webhookUrl, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    console.log(`Re-creating webhooks for account: ${username}`);
                    const requestBody = {
                        tag: "string",
                        endpoints: [
                            {
                                event_type: "trade.started",
                                url: "https://b-backend-xe8q.onrender.com/webhook",
                                enabled: true
                            },
                            {
                                event_type: "trade.chat_message_received",
                                url: "https://b-backend-xe8q.onrender.com/webhook",
                                enabled: true
                            }
                        ]
                    };

                    const createResponse = await axios.post(webhookUrl, requestBody, {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });

                    updateResults.push({ username, result: createResponse.data });
                } else {
                    updateResults.push({ username, message: "No updates required" });
                }
            } catch (error) {
                console.error(`Error updating webhooks for account: ${username}. Error:`, error.message);
                console.log(error);
                updateResults.push({ username, error: error.message });
            }
        }

        console.log('Update results:', updateResults);
    } catch (error) {
        console.error('Error during updates:', error.message);
    }
};


// Schedule the task to run every 2 minutes
cron.schedule('*/2 * * * *', () => {
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




const assignedTradeHashes = new Set();
const strictAssignedTradeHashes = new Set();
let staffPointer = 0; // To keep track of the staff index in the freeStaff array

const assignUnassignedTrades = async () => {
  try {
    // Step 1: Fetch free staff from MongoDB (clocked in)
    console.log("Fetching free staff from MongoDB...");
    const freeStaff = await Allstaff.find({
      clockedIn: true, // Only consider staff who are clocked in
    });

    if (freeStaff.length === 0) {
      console.log("No eligible staff available to assign unassigned trades.");
      return;
    }

    // Step 2: Fetch all unassigned trades from MongoDB
    console.log("Fetching unassigned trades from MongoDB...");
    const unassignedTrades = await ManualUnassigned.find().sort({ assignedAt: 1 });

    if (unassignedTrades.length === 0) {
      console.log("No unassigned trades available in MongoDB.");
      return;
    }

    // Step 3: Select the first available unassigned trade
    const unassignedTrade = unassignedTrades[0];

    // Step 4: Strict duplicate check
    if (assignedTradeHashes.has(unassignedTrade.trade_hash)) {
      console.log(`Trade ${unassignedTrade.trade_hash} is already being processed.`);
      strictAssignedTradeHashes.add(unassignedTrade.trade_hash);
      return; // Skip duplicate trades
    }

    console.log(`Processing trade ${unassignedTrade.trade_hash}...`);
    assignedTradeHashes.add(unassignedTrade.trade_hash);

    // Step 5: Select the current staff member based on the staffPointer
    const assignedStaff = freeStaff[staffPointer]; // Use the current staff pointer
    if (!assignedStaff) {
      console.log("No eligible staff available to assign trade.");
      return;
    }

    const assignedStaffUsername = assignedStaff.username;

    // Step 6: Assign trade to Firestore
    const staffRef = admin.firestore().collection("Allstaff").doc(assignedStaffUsername);
    const assignedAt = admin.firestore.Timestamp.now();
    const tradeData = {
      account: unassignedTrade.account.toString(),
      analytics: unassignedTrade.analytics,
      isPaid: false,
      assignedAt: assignedAt,
      trade_hash: unassignedTrade.trade_hash.toString(),
      seller_name: unassignedTrade.seller_name.toString(),
      handle: unassignedTrade.handle.toString(),
      fiat_amount_requested: unassignedTrade.fiat_amount_requested.toString(),
    };

    try {
      await staffRef.update({
        assignedTrades: admin.firestore.FieldValue.arrayUnion(tradeData),
      });
    } catch (error) {
      console.error(`Failed to assign trade in Firestore: ${error.message}`);
      return;
    }

    // Step 7: Update MongoDB for assigned staff
    console.log(`Updating MongoDB for staff ${assignedStaffUsername}...`);
    try {
      assignedStaff.assignedTrades.push({
        ...tradeData,
        assignedAt: assignedAt.toDate(), // Convert Firestore Timestamp to Date
      });
      await assignedStaff.save();
    } catch (error) {
      console.error(`Failed to update MongoDB for staff ${assignedStaffUsername}: ${error.message}`);
      return;
    }

    // Step 8: Remove trade from MongoDB's ManualUnassigned collection
    console.log(`Removing trade ${unassignedTrade.trade_hash} from ManualUnassigned collection...`);
    try {
      await ManualUnassigned.deleteOne({ _id: unassignedTrade._id });
    } catch (error) {
      console.error(`Failed to remove trade ${unassignedTrade.trade_hash}: ${error.message}`);
      return;
    }

    console.log(`Trade ${unassignedTrade.trade_hash} successfully assigned to ${assignedStaffUsername}.`);
    strictAssignedTradeHashes.add(unassignedTrade.trade_hash); // Add to strict check list

    // Step 9: Move to the next staff member for the next call
    staffPointer = (staffPointer + 1) % freeStaff.length; // Rotate the staff pointer
    console.log("Pointer moved to the next staff member for next API call.");

  } catch (error) {
    console.error("Error assigning unassigned trades:", error.message || error);
  }
};


  

  
  

  
