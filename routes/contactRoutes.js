const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const pool = require('../config/db');
const { sendAdminNotification, sendVisitorAutoReply } = require('../utils/mailer');

const router = express.Router();

// Limit each IP to 5 contact submissions per 15 minutes to deter spam/abuse
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: 'Too many messages sent. Please try again later.' },
});

const validateContact = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 150 }),
  body('email').trim().isEmail().withMessage('A valid email is required').normalizeEmail(),
  body('subject').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 5000 }),
];

router.post('/', contactLimiter, validateContact, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }

  const { name, email, subject, message } = req.body;
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

  try {
    const result = await pool.query(
      `INSERT INTO contacts (name, email, subject, message, ip_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, created_at`,
      [name, email, subject || null, message, ip]
    );

    const saved = result.rows[0];

    // Send emails but never let an email failure block the success response —
    // the message is already safely stored in Postgres either way.
    Promise.allSettled([
      sendAdminNotification({ name, email, subject, message, id: saved.id }),
      sendVisitorAutoReply({ name, email }),
    ]).then((outcomes) => {
      outcomes.forEach((outcome, i) => {
        if (outcome.status === 'rejected') {
          const label = i === 0 ? 'admin notification' : 'visitor auto-reply';
          console.error(`Failed to send ${label} email:`, outcome.reason?.message);
        }
      });
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully! I'll get back to you soon.",
      data: { id: saved.id, created_at: saved.created_at },
    });
  } catch (err) {
    console.error('Error saving contact message:', err.message);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }
});

module.exports = router;
