const express = require('express');
const router = express.Router();
const { handleRequest, retrieveTransactionLogs} = require("../controllers/openbanking"); // Fix this import
const { registerStaff, loginStaff, clockIn, clockOut, getstaffs, getStaffByName, resolveTradeComplaint } = require('../controllers/Staffs/staffauth');


//Staffs 
router.post("/register", registerStaff);
router.post("/login", loginStaff);
router.get("/staffs", getstaffs);
router.get("/staff/single/:name", getStaffByName);
router.post("/staff/complain/resolve", resolveTradeComplaint);

//Clockins 
router.post("/clockin",clockIn);
router.post("/clockout",clockOut);

//Transactions
router.post("/Transfer", handleRequest);
router.post("/Transactions", retrieveTransactionLogs);

module.exports = router;