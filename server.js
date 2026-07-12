const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const contactRoutes = require('./routes/contactRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

app.use(helmet());
app.use(express.json({ limit: '1mb' }));

// CORS: only allow the origins you list in .env (your live frontend + admin panel URLs)
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (curl, mobile apps, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.length === 0) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
  })
);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running', time: new Date().toISOString() });
});

app.use('/api/contact', contactRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Portfolio API server running on port ${PORT}`);
});
