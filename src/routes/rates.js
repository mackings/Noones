const express = require('express');
const { updatePaxfulPrice, getPaxfulUserInfo, getMultiplePaxfulUserInfo } = require('../controllers/Rate Config/paxful');
const { getPaxfulOffers, UpdateSingleMargin } = require('../controllers/Rate Config/Offers Config/paxfulOffer');
const { getMultiplePaxfulOffers, updatePricesForAllAccounts, updateOffersForSpecificAccount } = require('../controllers/Rate Config/flash Offer/paxful');
const { getBinanceRate, getAllDollarRates } = require('../controllers/Rate Config/marketrates');
const { getMultiplenoonesOffers, updatenoonesPricesForAllAccounts, updatenoonesOffersForSpecificAccount, updateNoonesWebhooksForAllAccounts, GetNoonesWebhooksForAllAccounts, getNoonesWebhooksForAllAccounts } = require('../controllers/Rate Config/flash Offer/noones');
const router = express.Router();





//Noones


//Webhook Update

router.post("/webhook/noones/update-multiple",updateNoonesWebhooksForAllAccounts);
router.get("/webhook/noones/get-multiple", getNoonesWebhooksForAllAccounts);

// Offers
router.get("/offers/noones/get-multiple", getMultiplenoonesOffers);

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

//Update Margins

router.post("/offers/paxful/margin/update-single", UpdateSingleMargin);
router.post("/offers/paxful/margin/update-multiple", updatePricesForAllAccounts);
router.post("/offers/paxful/margin/update-single-account", updateOffersForSpecificAccount);

//Market Rates
router.post("/market/rates", getAllDollarRates);

module.exports = router;