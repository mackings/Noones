const axios = require('axios');
const qs = require('qs');
const querystring = require('querystring');


const getPaxfulRatesToken = async (clientId, clientSecret) => {

  const tokenEndpoint = 'https://accounts.paxful.com/oauth2/token';
  const id = '2HATIKk9764Vw2u2OQOOe1Q8vh6vEUom3piooipCQQKOsiP5'; 
  const secret = 'v5gaTp66t8HgEfgNYlUTnzgu1To3f6nEwGqpSvRTfsuWewp6';

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
  const clientId = 'xQpyqheZ9o0hmPlGmUbazV5VWY1Cv63qXVhZy450IN11bgvR'; 
  const clientSecret = '9R77pmoW58eJ2ZoVpWndDfdmLjDqQbfQ1UNa4DjGbqtpL0vp';

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
        qs.stringify({ username: req.body.username }),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      return response.data;
    })();

    // Fetch Paxful rates
    const paxfulPromise = (async () => {
      const token = await getPaxfulRatesToken();
      const response = await axios.post(
        'https://api.paxful.com/paxful/v1/currency/btc?response=text',
        qs.stringify({ username: req.body.username }),
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      return response.data;
    })();

    // Fetch Binance rates
    const binancePromise = (async () => {
      const response = await axios.get('https://www.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
      const price = Math.round(parseFloat(response.data.price));
      return { price };
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
    console.error('Error fetching rates:', error);
    res.status(500).json({ error: 'Failed to fetch rates from all sources' });
  }
};
