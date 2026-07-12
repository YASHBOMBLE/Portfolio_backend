const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

// ---------------------------------------------------------------
// POST /api/admin/login
// ---------------------------------------------------------------
router.post(
  '/login',
  loginLimiter,
  [body('email').trim().isEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query('SELECT * FROM admin_users WHERE email = $1', [email.toLowerCase()]);
      const admin = result.rows[0];

      if (!admin) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const passwordMatches = await bcrypt.compare(password, admin.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }

      const token = jwt.sign(
        { id: admin.id, email: admin.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
      );

      return res.json({ success: true, token, admin: { id: admin.id, email: admin.email } });
    } catch (err) {
      console.error('Login error:', err.message);
      return res.status(500).json({ success: false, message: 'Server error during login.' });
    }
  }
);

// ---------------------------------------------------------------
// GET /api/admin/me  — verify token / restore session
// ---------------------------------------------------------------
router.get('/me', requireAdminAuth, (req, res) => {
  res.json({ success: true, admin: req.admin });
});

// ---------------------------------------------------------------
// GET /api/admin/messages?status=&page=&limit=&search=
// ---------------------------------------------------------------
router.get('/messages', requireAdminAuth, async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;
  const { status, search } = req.query;

  const conditions = [];
  const values = [];

  if (status && ['unread', 'read', 'replied'].includes(status)) {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(name ILIKE $${values.length} OR email ILIKE $${values.length} OR message ILIKE $${values.length})`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const dataQuery = `
      SELECT id, name, email, subject, message, status, created_at
      FROM contacts
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    const countQuery = `SELECT COUNT(*) FROM contacts ${whereClause}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...values, limit, offset]),
      pool.query(countQuery, values),
    ]);

    const total = parseInt(countResult.rows[0].count, 10);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('Error fetching messages:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/stats — quick counts for the dashboard cards
// ---------------------------------------------------------------
router.get('/stats', requireAdminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'unread') AS unread,
        COUNT(*) FILTER (WHERE status = 'read') AS read,
        COUNT(*) FILTER (WHERE status = 'replied') AS replied,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') AS last_7_days
      FROM contacts
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching stats:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ---------------------------------------------------------------
// PATCH /api/admin/messages/:id — update status (unread/read/replied)
// ---------------------------------------------------------------
router.patch('/messages/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['unread', 'read', 'replied'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value.' });
  }

  try {
    const result = await pool.query(
      'UPDATE contacts SET status = $1 WHERE id = $2 RETURNING id, status',
      [status, id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating message:', err.message);
    res.status(500).json({ success: false, message: 'Failed to update message.' });
  }
});

// ---------------------------------------------------------------
// DELETE /api/admin/messages/:id
// ---------------------------------------------------------------
router.delete('/messages/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id = $1 RETURNING id', [id]);
    if (!result.rows.length) {
      return res.status(404).json({ success: false, message: 'Message not found.' });
    }
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    console.error('Error deleting message:', err.message);
    res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
});

module.exports = router;
