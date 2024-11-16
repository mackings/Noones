const express = require('express');
const router = express.Router();
const { handleRequest, retrieveTransactionLogs} = require("../controllers/openbanking"); // Fix this import
const { registerStaff, loginStaff, clockIn, clockOut, getstaffs, getStaffByName, resolveTradeComplaint, createBank, chooseBank, recordInflow, getAllBanks, getInflowsForStaff, addMoneyToBank, getStaffBankInfo } = require('../controllers/Staffs/staffauth');
const { markTradeAsPaid } = require('../controllers/Rate Config/flash Offer/noones');


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

router.post("/Trade/noones/mark", markTradeAsPaid);
router.post("/Transfer", handleRequest);
router.post("/Transactions", retrieveTransactionLogs);

//Inflows

router.post("/banks/add-bank", createBank);
router.post("/banks/add-money", addMoneyToBank);
router.get('/banks/info/:username', getStaffBankInfo);
router.post("/banks/choose-bank", chooseBank);
router.post("/banks/debit-bank", recordInflow);
router.get("/banks/all-bank", getAllBanks);
router.get("/banks/staff-inflow/:staffId", getInflowsForStaff);


module.exports = router;