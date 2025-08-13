const express = require('express');
const router = express.Router();
const controller = require('../controllers/messageController');

// Original endpoint for generating messages from health data
router.post('/generate', controller.generateMessage);

// New endpoint for generating messages by user ID
router.get('/generate', controller.generateMessageByUserId);

module.exports = router;
