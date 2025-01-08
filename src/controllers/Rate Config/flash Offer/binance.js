// const express = require('express');
// const axios = require('axios');
// const crypto = require('crypto');
// const querystring = require('querystring');


// // Binance API keys
// const API_KEY = 'WlrmfciTl4gtCwYeHiZMSvMMWqilFPCweBZeWHEEUnNOsJZYsaXlnxB55APRXgQU';
// const API_SECRET = 'cyHA4Df2tkXMM0xWge6kYsDSYOiSA2SKp5axiEtGCxdZBQ10KSyi69JlbMF1JNxE';

// // Utility function to create a signature
// function createSignature(queryString) {
//     return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
// }

// // Function to get BTC balance
// exports.getBinanceBalance = async () => {
//     try {
//         const timestamp = Date.now();
//         const query = `timestamp=${timestamp}`;
//         const signature = createSignature(query);

//         const config = {
            
//             headers: {
//                 'X-MBX-APIKEY': API_KEY,
//             },
//         };

//         const response = await axios.get(
//             `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
//             config
//         );
//         console.log(response);

//         const btcBalance = response.data.balances.find(asset => asset.asset === 'BTC');
//         if (!btcBalance) {
//             return { message: 'BTC balance not found' };
//         }

//         return {
//             asset: 'BTC',
//             free: btcBalance.free,
//             locked: btcBalance.locked,
//         };
//     } catch (error) {
//         console.error(error.response ? error.response.data : error.message);
//         return { error: 'Failed to fetch BTC balance' };
//     }
// };






const { USDMClient } = require('binance');

// Binance API credentials
const API_KEY = 'WlrmfciTl4gtCwYeHiZMSvMMWqilFPCweBZeWHEEUnNOsJZYsaXlnxB55APRXgQU';
const API_SECRET = 'cyHA4Df2tkXMM0xWge6kYsDSYOiSA2SKp5axiEtGCxdZBQ10KSyi69JlbMF1JNxE';

// Initialize the USDMClient for Futures API
const client = new USDMClient({
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Function to get BTC Futures balance
exports.getBinanceBalance = async () => {
  try {
    // Get the balance for all assets in the Futures account
    const balance = await client.getBalance();
    
    // Find the BTC balance from the result
    const btcBalance = balance.find(asset => asset.asset === 'BTC');
    
    if (!btcBalance) {
      return { message: 'BTC balance not found' };
    }

    return {
      asset: 'BTC',
      free: btcBalance.availableBalance,
      locked: btcBalance.allocatedBalance,
    };
  } catch (error) {
    console.error('Error fetching balance: ', error);
    return { error: 'Failed to fetch BTC balance' };
  }
};


