const express = require('express');
const router = express.Router();
const controller = require('../controllers/fitrockrController');

router.get('/users', controller.getUsers);
router.get('/users/:userId', controller.getUser);
router.get('/daily-summary/:userId', controller.getDailySummary);

module.exports = router;
