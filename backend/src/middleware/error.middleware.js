/**
 * Global Express Error Handler
 */
const { logger } = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: `Duplicate entry: ${err.meta?.target?.join(', ')} already exists.`,
    });
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  // Validation / business logic errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }

  // Default 500
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again.'
      : err.message,
  });
}

/** Helper to create typed errors */
function createError(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { errorHandler, createError };
