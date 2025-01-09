const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');


// Binance API keys
const API_KEY = 'WlrmfciTl4gtCwYeHiZMSvMMWqilFPCweBZeWHEEUnNOsJZYsaXlnxB55APRXgQU';
const API_SECRET = 'cyHA4Df2tkXMM0xWge6kYsDSYOiSA2SKp5axiEtGCxdZBQ10KSyi69JlbMF1JNxE';

// Utility function to create a signature
function createSignature(queryString) {
    return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
}

// Function to get BTC balance
exports.getBinanceBalance = async () => {
    
    try {
        const timestamp = Date.now();
        const query = `timestamp=${timestamp}`;
        const signature = createSignature(query);

        const config = {
            
            headers: {
                'X-MBX-APIKEY': API_KEY,
            },
        };

        const response = await axios.get(
            `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
            config
        );
        console.log(response);

        const btcBalance = response.data.balances.find(asset => asset.asset === 'BTC');
        if (!btcBalance) {
            return { message: 'BTC balance not found' };
        }

        return {
            asset: 'BTC',
            free: btcBalance.free,
            locked: btcBalance.locked,
        };
    } catch (error) {
        console.error(error.response ? error.response.data : error.message);
        return { error: 'Failed to fetch BTC balance' };
    }
};








// // Binance API keys
// const API_KEY = 'WlrmfciTl4gtCwYeHiZMSvMMWqilFPCweBZeWHEEUnNOsJZYsaXlnxB55APRXgQU';
// const API_SECRET = 'cyHA4Df2tkXMM0xWge6kYsDSYOiSA2SKp5axiEtGCxdZBQ10KSyi69JlbMF1JNxE';
// const PROXY_SERVER_IP = '47.251.122.81';
// const PROXY_SERVER_PORT = '8888';

// function createSignature(queryString) {
//     return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
// }

// const axios = require('axios');

// exports.getBinanceBalance = async () => {

//     try {
//         const timestamp = Date.now();
//         const query = timestamp=${timestamp};
//         const signature = createSignature(query);

//         // Proxy configuration
//         const proxy = {
//             host: PROXY_SERVER_IP,
//             port: PROXY_SERVER_PORT
//         };
//         // const proxy = {
//         //     host: PROXY_SERVER_IP,
//         //     port: PROXY_SERVER_PORT,
//         //     auth: {
//         //         username: 'your-proxy-username',
//         //         password: 'your-proxy-password',
//         //     },
//         // };

//         // Axios configuration
//         const config = {
//             headers: {
//                 'X-MBX-APIKEY': API_KEY,
//             },
//             proxy, // Include the proxy configuration
//         };

//         // Binance API call
//         const response = await axios.get(
//             https://api.binance.com/api/v3/account?${query}&signature=${signature},
//             config
//         );

//         console.log(response);

//         // Extract BTC balance
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
