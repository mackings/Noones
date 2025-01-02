const axios = require('axios');
const qs = require('qs');
const querystring = require('querystring');
const SellingPrice = require("../Model/sellingprice");


const getPaxfulRatesToken = async (clientId, clientSecret) => {

  const tokenEndpoint = 'https://accounts.paxful.com/oauth2/token';
  const id = 'E53VOgIDNN7bOglY12HrSSTZMrf33pFI6lDSVBkQmaLNVz11'; 
  const secret = 'EmfnR8buyg2N9ILhGWtm1MDOzItRpFV3sbmBftdklIM480tn';

  const response = await axios.post(tokenEndpoint, querystring.stringify({
      grant_type: 'client_credentials',
      client_id: id,
      client_secret: secret,
  }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data.access_token;
}



const getNoonesRatesToken = async () => {

  const tokenEndpoint = 'https://auth.noones.com/oauth2/token';
  const clientId = 'Yq0XIIVCnyjYgDKJBUg0Atz37uFKFNAt66r13PnLkGK9cvTI'; 
  const clientSecret = 'o5hICv2hrS8Vmuq2jrOmZj9WwMX4rCWIi6mPscfYCQrH2zyi';

  const response = await axios.post(tokenEndpoint, querystring.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
  }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  return response.data.access_token;
};


exports.getAllDollarRates = async (req, res) => {
  try {
    // Fetch Noones rates
    const noonesPromise = (async () => {
      const token = await getNoonesRatesToken();
      const response = await axios.post(
        'https://api.noones.com/noones/v1/currency/btc?response=text',
        qs.stringify({ username: req.body.nusername }),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      return { platform: 'Noones', data: response.data };
    })();

    // Fetch Paxful rates
    const paxfulPromise = (async () => {
      const token = await getPaxfulRatesToken();
      const response = await axios.post(
        'https://api.paxful.com/paxful/v1/currency/btc?response=text',
        qs.stringify({ username: req.body.pusername }),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      return { platform: 'Paxful', data: response.data };
    })();

    // Fetch Binance rates
    const binancePromise = (async () => {
      const response = await axios.get('https://www.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const price = Math.round(parseFloat(response.data.price));
      return { platform: 'Binance', price };
    })();

    // Execute all promises concurrently
    const [noonesRate, paxfulRate, binanceRate] = await Promise.all([noonesPromise, paxfulPromise, binancePromise]);

    // Return all rates in one response
    res.json({
      noonesRate,
      paxfulRate,
      binanceRate
    });

  } catch (error) {
    if (error.response) {
      console.error('API Error:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    res.status(500).json({ error: 'Failed to fetch rates from all sources' });
  }
};


exports.saveSellingPrice = async (req, res) => {
  try {
      const { price } = req.body;

      // Validate that price is provided and is a valid number
      if (price === undefined || typeof price !== 'number' || price <= 0) {
          return res.status(400).json({ message: 'A valid price is required and must be greater than 0.' });
      }

      // Check if a selling price already exists and update it
      const updatedSellingPrice = await SellingPrice.findOneAndUpdate(
          {}, // No filter to update the single document
          { price }, // Set the new price
          { new: true, upsert: true } // Create a new document if none exists
      );

      res.status(200).json({ message: 'Selling price updated successfully', data: updatedSellingPrice });
  } catch (error) {
      console.error('Error updating selling price:', error);
      res.status(500).json({ message: 'An error occurred while updating the selling price', error });
  }
};



exports.getSellingPrice = async (req, res) => {
  try {
      // Fetch the most recent selling price
      const sellingPrice = await SellingPrice.findOne().sort({ createdAt: -1 });

      if (!sellingPrice) {
          return res.status(404).json({ message: 'No selling price found' });
      }

      res.status(200).json({ message: 'Selling price retrieved successfully', data: sellingPrice });
  } catch (error) {
      console.error('Error retrieving selling price:', error);
      res.status(500).json({ message: 'An error occurred while retrieving the selling price', error });
  }
};
