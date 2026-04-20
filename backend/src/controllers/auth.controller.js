/**
 * Auth Controller
 * OTP-based mobile/email login with JWT tokens
 */
const { validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const { logger } = require('../utils/logger');

/**
 * Generate a 6-digit OTP and store it in DB
 * In production: send via Twilio SMS
 * In development: log to console (MOCK_OTP=true)
 */
async function requestOTP(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { mobile, email } = req.body;
    const identifier = mobile || email;

    // Find or create user
    let user = await prisma.user.findFirst({
      where: mobile ? { mobile } : { email },
    });

    if (!user) {
      user = await prisma.user.create({
        data: mobile ? { mobile } : { email },
      });
    }

    // Invalidate previous OTPs for this user
    await prisma.otpCode.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    // Generate OTP
    const otp = process.env.MOCK_OTP === 'true'
      ? (process.env.FIXED_DEV_OTP || '123456')
      : String(Math.floor(100000 + Math.random() * 900000));

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpCode.create({
      data: { userId: user.id, code: otp, expiresAt },
    });

    // Send OTP
    if (process.env.MOCK_OTP === 'true') {
      logger.info(`[DEV MODE] OTP for ${identifier}: ${otp}`);
    } else {
      // Production: send via Twilio
      const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await twilio.messages.create({
        body: `Your BizGST OTP is: ${otp}. Valid for 10 minutes. Do not share.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+91${mobile}`,
      });
    }

    res.json({
      success: true,
      message: `OTP sent to ${identifier}`,
      // Only expose in dev for testing
      ...(process.env.NODE_ENV === 'development' && { devOtp: otp }),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Verify OTP and return JWT token
 */
async function verifyOTP(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { mobile, email, otp } = req.body;

    // Find user
    const user = await prisma.user.findFirst({
      where: mobile ? { mobile } : { email },
      include: {
        businesses: {
          select: { id: true, name: true, gstin: true, stateCode: true, stateName: true },
        },
      },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found. Please request OTP first.' });
    }

    // Validate OTP
    const otpRecord = await prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        code: otp,
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!otpRecord) {
      return res.status(401).json({ success: false, error: 'Invalid or expired OTP.' });
    }

    // Mark OTP as used
    await prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { used: true },
    });

    // Mark user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    // Generate JWT
    const token = jwt.sign(
      {
        userId: user.id,
        mobile: user.mobile,
        email:  user.email,
        // Attach first business if exists
        businessId: user.businesses[0]?.id || null,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id:        user.id,
        mobile:    user.mobile,
        email:     user.email,
        name:      user.name,
        hasBusinessProfile: user.businesses.length > 0,
        businesses: user.businesses,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get current authenticated user's profile
 */
async function getProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        businesses: true,
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { requestOTP, verifyOTP, getProfile };
