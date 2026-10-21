const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { config } = require('../config');

const dummyHashPromise = bcrypt.hash('not-a-valid-administrator-password', 12);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/'
  };
}

async function login(req, res, next) {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const errors = [];
    if (!emailPattern.test(email) || email.length > 254) errors.push({ field: 'email', message: 'Enter a valid email address.' });
    if (!password || password.length > 128) errors.push({ field: 'password', message: 'Enter your password.' });
    if (errors.length) return res.status(400).json({ message: 'Check the sign-in details and try again.', errors });

    const admin = await Admin.findOne({ email }).select('+passwordHash name email role');
    const passwordMatches = await bcrypt.compare(password, admin ? admin.passwordHash : await dummyHashPromise);
    if (!admin || !passwordMatches) {
      return res.status(401).json({ message: 'Email or password is incorrect.' });
    }
    if (admin.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });

    const token = jwt.sign({ sub: admin.id, role: admin.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.cookie('northstar_admin', token, cookieOptions());
    return res.status(200).json({ admin: { name: admin.name, email: admin.email, role: admin.role } });
  } catch (error) {
    return next(error);
  }
}

function logout(req, res) {
  res.clearCookie('northstar_admin', cookieOptions());
  return res.status(200).json({ message: 'Signed out.' });
}

module.exports = { login, logout, cookieOptions };