const express = require('express');
const { updatePaxfulPrice, getPaxfulUserInfo, getMultiplePaxfulUserInfo } = require('../controllers/Rate Config/paxful');
const { getPaxfulOffers, UpdateSingleMargin } = require('../controllers/Rate Config/Offers Config/paxfulOffer');
const { getMultiplePaxfulOffers, updatePricesForAllAccounts, updateOffersForSpecificAccount, turnOnPaxfulOffersForAllaccounts } = require('../controllers/Rate Config/flash Offer/paxful');
const { getBinanceRate, getAllDollarRates, saveSellingPrice, getSellingPrice } = require('../controllers/Rate Config/marketrates');
const { getMultiplenoonesOffers, updatenoonesPricesForAllAccounts, updatenoonesOffersForSpecificAccount, updateNoonesWebhooksForAllAccounts, GetNoonesWebhooksForAllAccounts, getNoonesWebhooksForAllAccounts, checkWalletBalances, turnOnOffersForAllAccounts, turnOffOffersForAllAccounts } = require('../controllers/Rate Config/flash Offer/noones');
const { getBinanceBalance } = require('../controllers/Rate Config/flash Offer/binance');
const router = express.Router();





//Noones
router.get("/webhook/noones/get-multiple", getNoonesWebhooksForAllAccounts);



// Offers
router.get("/offers/noones/get-multiple", getMultiplenoonesOffers);

//Turn ON / OFF
router.post("/offers/noones/turn-on", turnOnOffersForAllAccounts);
router.post("/offers/noones/turn-off", turnOffOffersForAllAccounts);


//Update Margins
router.post("/offers/noones/margin/update-single", UpdateSingleMargin);
router.post("/offers/noones/margin/update-multiple", updatenoonesPricesForAllAccounts);
router.post("/offers/noones/margin/update-single-account", updatenoonesOffersForSpecificAccount);





//Paxful 


router.post("/update-rate/paxful", updatePaxfulPrice);
router.post("/account-info/paxful", getPaxfulUserInfo);
router.get("/multipleaccount-info/paxful", getMultiplePaxfulUserInfo);

// Offers
router.get("/offers/paxful/get-single", getPaxfulOffers);
router.get("/offers/paxful/get-multiple", getMultiplePaxfulOffers);

//Turn ON / OFF
router.post("/offers/paxful/turn-on",  turnOnPaxfulOffersForAllaccounts);
router.post("/offers/paxful/turn-off", turnOnPaxfulOffersForAllaccounts )


//Update Margins

router.post("/offers/paxful/margin/update-single", UpdateSingleMargin);
router.post("/offers/paxful/margin/update-multiple", updatePricesForAllAccounts);
router.post("/offers/paxful/margin/update-single-account", updateOffersForSpecificAccount);

//Market Rates
router.post("/market/rates", getAllDollarRates);
router.post("/selling/upload", saveSellingPrice);
router.get("/get-sprice", getSellingPrice);


//Wallet Balances

router.get("/wallet/noones/balance", checkWalletBalances);




//Binance


router.get("/binance/balance", getBinanceBalance);

module.exports = router;