const express = require('express');
const router = express.Router();
const prisma = require('../../config/prisma');
const { authenticate, requireBusiness } = require('../middleware/auth.middleware');

router.use(authenticate, requireBusiness);

router.get('/', async (req, res, next) => {
  try {
    const { type, search } = req.query;
    const parties = await prisma.party.findMany({
      where: {
        businessId: req.user.businessId,
        isActive: true,
        ...(type && { type: type.toUpperCase() }),
        ...(search && { name: { contains: search, mode: 'insensitive' } }),
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: parties });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const party = await prisma.party.create({
      data: { ...req.body, businessId: req.user.businessId },
    });
    res.status(201).json({ success: true, data: party });
  } catch (err) { next(err); }
});

module.exports = router;
