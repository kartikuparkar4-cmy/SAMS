const express = require('express');
const rateLimit = require('express-rate-limit');
const { login, logout } = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts. Please try again later.' }
});

router.post('/login', loginLimit, login);
router.post('/logout', authenticate, requireAdmin, logout);

module.exports = router;