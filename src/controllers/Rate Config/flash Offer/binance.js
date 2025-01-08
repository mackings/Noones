const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');
const { HttpsProxyAgent } = require('https-proxy-agent');


// Binance API keys
const API_KEY = 'WlrmfciTl4gtCwYeHiZMSvMMWqilFPCweBZeWHEEUnNOsJZYsaXlnxB55APRXgQU';
const API_SECRET = 'cyHA4Df2tkXMM0xWge6kYsDSYOiSA2SKp5axiEtGCxdZBQ10KSyi69JlbMF1JNxE';

// Utility function to create a signature
function createSignature(queryString) {
    return crypto.createHmac('sha256', API_SECRET).update(queryString).digest('hex');
}

const proxyAgent = new HttpsProxyAgent('http://47.237.92.86:8081'); // Replace with actual proxy

// Function to get BTC balance
exports.getBinanceBalance = async () => {

    try {
        const timestamp = Date.now();
        const query = `timestamp=${timestamp}`;
        const signature = createSignature(query);

        const config = {
            httpsAgent: proxyAgent,
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

