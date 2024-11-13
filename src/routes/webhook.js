const express = require('express');
const router = express.Router();
const { webhookHandler } = require('../controllers/webhookcontroller');

router.post('v1/webhook', webhookHandler);

module.exports = router;