const { validationResult } = require('express-validator');
const prisma = require('../../config/prisma');
const { validateGSTIN } = require('../services/gst.engine');
const { createError } = require('../middleware/error.middleware');

// Indian state codes lookup
const STATE_CODES = {
  '01':'Jammu & Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
  '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
  '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
  '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
  '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh','24':'Gujarat',
  '26':'Dadra & Nagar Haveli','27':'Maharashtra','28':'Andhra Pradesh','29':'Karnataka',
  '30':'Goa','31':'Lakshadweep','32':'Kerala','33':'Tamil Nadu','34':'Puducherry',
  '35':'Andaman & Nicobar','36':'Telangana','37':'Andhra Pradesh (New)',
};

async function getBusinessProfile(req, res, next) {
  try {
    const business = await prisma.business.findFirst({
      where: { userId: req.user.userId },
    });
    res.json({ success: true, data: business });
  } catch (err) { next(err); }
}

async function createBusiness(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

    const { name, gstin, address, businessType } = req.body;

    if (!validateGSTIN(gstin)) {
      return res.status(422).json({ success: false, error: 'Invalid GSTIN format.' });
    }

    const stateCode = gstin.slice(0, 2);
    const stateName = STATE_CODES[stateCode] || 'Unknown State';

    const existing = await prisma.business.findUnique({ where: { gstin: gstin.toUpperCase() } });
    if (existing) return res.status(409).json({ success: false, error: 'GSTIN already registered.' });

    const business = await prisma.business.create({
      data: {
        userId: req.user.userId,
        name,
        gstin:       gstin.toUpperCase(),
        stateCode,
        stateName,
        address:     address || null,
        businessType: businessType || 'RETAIL',
      },
    });

    res.status(201).json({ success: true, data: business });
  } catch (err) { next(err); }
}

async function updateBusiness(req, res, next) {
  try {
    const business = await prisma.business.findFirst({
      where: { userId: req.user.userId },
    });
    if (!business) throw createError('Business not found', 404);

    const updated = await prisma.business.update({
      where: { id: business.id },
      data: {
        name:    req.body.name    || business.name,
        address: req.body.address || business.address,
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

module.exports = { getBusinessProfile, createBusiness, updateBusiness };
