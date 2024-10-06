const express = require('express');
const { updatePaxfulPrice, getPaxfulUserInfo, getMultiplePaxfulUserInfo } = require('../controllers/Rate Config/paxful');
const { getPaxfulOffers } = require('../controllers/Rate Config/Offers Config/paxfulOffer');
const router = express.Router();


//Paxful 

router.post("/update-rate/paxful", updatePaxfulPrice);
router.post("/account-info/paxful", getPaxfulUserInfo);
router.get("/multipleaccount-info/paxful", getMultiplePaxfulUserInfo);

router.get("/offers/paxful/get-single", getPaxfulOffers);



module.exports = router;