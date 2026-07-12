/**
 * Run once with: npm run init-db
 * Creates the tables (if not already created via pgAdmin) and the first admin account.
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
require('dotenv').config();

async function run() {
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
    await pool.query(schemaSql);
    console.log('Schema ensured (contacts + admin_users tables ready).');

    const email = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const password = process.env.ADMIN_PASSWORD;

    if (!email || !password) {
      console.log('ADMIN_EMAIL / ADMIN_PASSWORD not set in .env — skipping admin user creation.');
      process.exit(0);
    }

    const existing = await pool.query('SELECT id FROM admin_users WHERE email = $1', [email]);
    if (existing.rows.length) {
      console.log(`Admin user ${email} already exists — skipping.`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO admin_users (email, password_hash) VALUES ($1, $2)', [email, passwordHash]);
    console.log(`Admin user created: ${email}`);
    console.log('You can now log in at /admin using this email and the password from your .env file.');
    process.exit(0);
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    process.exit(1);
  }
}

run();
