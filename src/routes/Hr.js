const express = require('express');
const { createPayroll, getAllStaffPayrolls } = require('../controllers/Hr/payroll');
const { sendQueryToStaff, getStaffQueries, respondToQuery, hrRespondToQuery, getQueryReplies, removeQueryFromStaff } = require('../controllers/Hr/query');
const router = express.Router();


//PayRolls
router.post('/createpayroll',createPayroll );
router.get('/payroll/all', getAllStaffPayrolls);

//Queries
router.post('/createquery',sendQueryToStaff);
router.delete('/removequery',removeQueryFromStaff);
router.get('/getquery/single/:name', getStaffQueries);
router.post('/query/staffreply', respondToQuery);
router.post('/query/hrreply', hrRespondToQuery);
router.post('/getquery/messages', getQueryReplies);


module.exports = router;