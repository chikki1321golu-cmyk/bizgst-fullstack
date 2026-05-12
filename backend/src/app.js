/**
 * BizGST — Express App Configuration
 * Registers all middleware, routes, and error handlers
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const businessRoutes = require('./routes/business.routes');
const salesRoutes = require('./routes/sales.routes');
const purchasesRoutes = require('./routes/purchases.routes');
const productsRoutes = require('./routes/products.routes');
const partiesRoutes = require('./routes/parties.routes');
const gstRoutes = require('./routes/gst.routes');
const exportRoutes = require('./routes/export.routes');
const { errorHandler } = require('./middleware/error.middleware');
const { logger } = require('./utils/logger');

const app = express();

// ── Security Headers ────────────────────────
app.use(helmet());

// ── CORS ────────────────────────────────────
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:3000',
      'https://localhost:3000',
    ].filter(Boolean);

    // Allow any vercel.app domain automatically
    if (
      allowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.railway.app')
    ) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Rate Limiting ───────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many auth attempts, please try again after 15 minutes.' },
});
app.use('/api/auth/', authLimiter);

// ── Body Parsing ────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Request Logging ─────────────────────────
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ── Health Check ────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

// ── API Routes ──────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/parties', partiesRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/export', exportRoutes);

// ── 404 Handler ─────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.originalUrl} not found` });
});

// ── Global Error Handler ────────────────────
app.use(errorHandler);

module.exports = app;
