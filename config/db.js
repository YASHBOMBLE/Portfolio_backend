const { Pool } = require('pg');
require('dotenv').config();

// This pool connects using the exact same credentials you use to
// connect in pgAdmin (host, port, database, user, password).
const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

pool.on('connect', () => {
  console.log('PostgreSQL pool: new client connected');
});

module.exports = pool;
