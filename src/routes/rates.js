const express = require('express');
const { updatePaxfulPrice, getPaxfulUserInfo } = require('../controllers/Rate Config/paxful');
const router = express.Router();



//Paxful 

router.post("/update-rate/paxful", updatePaxfulPrice);
router.post("/account-info/paxful", getPaxfulUserInfo);

module.exports = router;