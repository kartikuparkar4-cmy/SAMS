const bcrypt = require('bcryptjs');
const { config, validateConfig } = require('../config');
const { connectDatabase } = require('../config/db');
const Admin = require('../models/Admin');

async function createAdmin() {
  const name = (process.env.ADMIN_NAME || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!name || !email || password.length < 12) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD (at least 12 characters) for this one-time command.');
  }
  validateConfig();
  await connectDatabase(config.mongoUri);
  const existing = await Admin.exists({ email });
  if (existing) throw new Error('An administrator with that email already exists.');
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.create({ name, email, passwordHash, role: 'admin' });
  console.log(`Administrator ${email} created. Remove ADMIN_PASSWORD from the environment now.`);
}

createAdmin().catch((error) => {
  console.error(`Administrator creation failed: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await require('mongoose').disconnect();
});