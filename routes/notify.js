const express = require('express');
const router = express.Router();
const controller = require('../controllers/notifyController');

router.post('/send', controller.sendNotification);

module.exports = router;
