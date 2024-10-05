const axios = require('axios');

exports.getPaxfulRate = async (req, res) => {
  const paxfulApi = req.context.services.paxfulApi;

  try {
    const response = await paxfulApi.invoke('/paxful/v1/currency/btc?response=text', {});
    const price = parseFloat(response);

    if (isNaN(price)) {
      return res.status(500).json({ status: 'error', message: 'Invalid price data' });
    }

    res.json({ price });
    console.log(`Paxful Price: ${price}`);
  } catch (error) {
    console.error('Error fetching Paxful rate:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch price from Paxful', error });
  }
};


exports.getBinanceRate = async (req, res) => {
    
  try {
    const response = await axios.get('https://www.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
    const price = Math.round(parseFloat(response.data.price));

    res.json({ price });
  } catch (error) {
    console.error('Error fetching Binance rate:', error);
    res.status(500).json({ error: 'Failed to fetch the price from Binance' });
  }
};
