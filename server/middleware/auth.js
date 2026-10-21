const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { config } = require('../config');

function readAuthCookie(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)northstar_admin=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function authenticate(req, res, next) {
  const token = readAuthCookie(req);
  if (!token) return res.status(401).json({ message: 'Administrator sign-in is required.' });

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const admin = await Admin.findById(payload.sub).select('name email role');
    if (!admin) return res.status(401).json({ message: 'Your sign-in has expired. Please sign in again.' });
    req.admin = admin;
    return next();
  } catch {
    return res.status(401).json({ message: 'Your sign-in has expired. Please sign in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.admin || req.admin.role !== 'admin') {
    return res.status(403).json({ message: 'Administrator access is required.' });
  }
  return next();
}

module.exports = { authenticate, requireAdmin };