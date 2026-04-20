// ─── auth.routes.js ───────────────────────────────────────────
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { requestOTP, verifyOTP, getProfile } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.post('/otp-request',
  [
    body('mobile').optional().isMobilePhone('en-IN').withMessage('Invalid Indian mobile number'),
    body('email').optional().isEmail().withMessage('Invalid email address'),
  ],
  requestOTP
);

router.post('/otp-verify',
  [
    body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits').isNumeric(),
    body('mobile').optional().isMobilePhone('en-IN'),
    body('email').optional().isEmail(),
  ],
  verifyOTP
);

router.get('/profile', authenticate, getProfile);

module.exports = router;
