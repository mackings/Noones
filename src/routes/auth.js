const express = require('express');
const router = express.Router();
const { updatePrice, useAccessToken } = require('../controllers/authcontroller');

router.post('/update-price', updatePrice);
router.post('/user-info', useAccessToken);

module.exports = router;
