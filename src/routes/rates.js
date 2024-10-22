const express = require('express');
const { updatePaxfulPrice, getPaxfulUserInfo, getMultiplePaxfulUserInfo } = require('../controllers/Rate Config/paxful');
const { getPaxfulOffers, UpdateSingleMargin } = require('../controllers/Rate Config/Offers Config/paxfulOffer');
const { getMultiplePaxfulOffers, updatePricesForAllAccounts, updateOffersForSpecificAccount } = require('../controllers/Rate Config/flash Offer/paxful');
const { getBinanceRate, getAllDollarRates } = require('../controllers/Rate Config/marketrates');
const router = express.Router();


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