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





// const express = require('express');
// const axios = require('axios');
// const crypto = require('crypto');
// const querystring = require('querystring');
// const axiosProxy = require('axios-https-proxy-fix'); // Import proxy package

// // Binance API keys
// const API_KEY = 'WlrmfciTl4gtCwYeHiZMSvMMWqilFPCweBZeWHEEUnNOsJZYsaXlnxB55APRXgQU';
// const API_SECRET = 'cyHA4Df2tkXMM0xWge6kYsDSYOiSA2SKp5axiEtGCxdZBQ10KSyi69JlbMF1JNxE';

// // Utility function to create a signature
// function createSignature(queryString) {
//     return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
// }

// // Configure Axios to use a proxy
// const proxy = {
//     host: '67.43.236.19',
//     port: 10009, // replace with your proxy's port
//     protocol: 'http', // or 'https'
//     // auth: {
//     //     username: 'proxyUsername', // if authentication is required
//     //     password: 'proxyPassword'
//     // }
// };

// const axiosInstance = axiosProxy.create({
//     proxy: proxy
// });

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

//         // Make the request using the configured axios instance with proxy
//         const response = await axiosInstance.get(
//             `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
//             config
//         );

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


