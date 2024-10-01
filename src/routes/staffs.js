const express = require('express');
const router = express.Router();
const { handleRequest, retrieveTransactionLogs} = require("../controllers/openbanking"); // Fix this import
const { registerStaff } = require('../controllers/Staffs/staffauth');


//Staffs 
router.post("/register", registerStaff);
//Transactions
router.post("/Transfer", handleRequest);
router.post("/Transactions", retrieveTransactionLogs);

module.exports = router;