const express = require('express');
const { createPayroll, getAllStaffPayrolls } = require('../controllers/Hr/payroll');
const { sendQueryToStaff, getStaffQueries, respondToQuery, hrRespondToQuery } = require('../controllers/Hr/query');
const router = express.Router();


//PayRolls
router.post('/createpayroll',createPayroll );
router.get('/payroll/all', getAllStaffPayrolls);

//Queries
router.post('/createquery',sendQueryToStaff);
router.get('/getquery/single', getStaffQueries);
router.post('/query/staffreply', respondToQuery);
router.post('/query/hrreply', hrRespondToQuery);

module.exports = router;