const express = require('express');
const router = express.Router();
const { webhookHandler } = require('../controllers/webhookcontroller');

router.post('webhook/v1', webhookHandler);

module.exports = router;