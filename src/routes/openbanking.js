const express = require('express');
const router = express.Router();
const { handleRequest, retrieveTransactionLogs} = require("../controllers/openbanking"); // Fix this import

router.post("/Transfer", handleRequest);
router.post("/Transactions", retrieveTransactionLogs);

module.exports = router;