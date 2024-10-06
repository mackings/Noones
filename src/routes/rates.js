const express = require('express');
const { updatePaxfulPrice, getPaxfulUserInfo, getMultiplePaxfulUserInfo } = require('../controllers/Rate Config/paxful');
const { getPaxfulOffers, UpdateSingleMargin } = require('../controllers/Rate Config/Offers Config/paxfulOffer');
const { getMultiplePaxfulOffers } = require('../controllers/Rate Config/flash Offer/paxful');
const router = express.Router();


//Paxful 

router.post("/update-rate/paxful", updatePaxfulPrice);
router.post("/account-info/paxful", getPaxfulUserInfo);
router.get("/multipleaccount-info/paxful", getMultiplePaxfulUserInfo);

// Offers
router.get("/offers/paxful/get-single", getPaxfulOffers);
router.get("/offers/paxful/get-multiple", getMultiplePaxfulOffers);

//Update Margin

router.post("/offers/paxful/margin/update-single", UpdateSingleMargin);

module.exports = router;