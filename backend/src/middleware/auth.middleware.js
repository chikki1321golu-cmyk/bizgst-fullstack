/**
 * JWT Authentication Middleware
 * Validates Bearer token and attaches user/business context to req
 */
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided. Please login first.',
      });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, error: 'Session expired. Please login again.' });
      }
      return res.status(401).json({ success: false, error: 'Invalid token.' });
    }

    // Attach user context — businessId comes from token (set at login)
    req.user = {
      userId:     decoded.userId,
      mobile:     decoded.mobile,
      email:      decoded.email,
      businessId: decoded.businessId,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware to ensure business profile exists
 * Use on routes that require a fully set-up account
 */
async function requireBusiness(req, res, next) {
  if (!req.user.businessId) {
    return res.status(403).json({
      success: false,
      error: 'Business profile not set up. Please complete your profile first.',
    });
  }
  next();
}

module.exports = { authenticate, requireBusiness };
