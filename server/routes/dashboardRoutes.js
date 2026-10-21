const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { getSummary } = require('../controllers/dashboardController');

const router = express.Router();

router.get('/summary', authenticate, requireAdmin, getSummary);

module.exports = router;