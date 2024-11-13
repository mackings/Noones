const express = require('express');
const router = express.Router();
const { webhookHandler } = require('../controllers/webhookcontroller');

router.post('webhook', webhookHandler);

module.exports = router;