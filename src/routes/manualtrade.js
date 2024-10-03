const express = require('express');
const router = express.Router();
const { handleRequest, retrieveTransactionLogs} = require("../controllers/openbanking"); // Fix this import
const { markTradeAsPaid } = require('../controllers/Trade Marking/mark');

router.post("/Transfer", handleRequest);
router.post("/Transactions", retrieveTransactionLogs);

//Trade Marking

router.post("/Marktrade",markTradeAsPaid );

module.exports = router;