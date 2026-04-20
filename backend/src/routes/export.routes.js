const express = require('express');
const router = express.Router();
const { authenticate, requireBusiness } = require('../middleware/auth.middleware');
const { getGSTR1, getGSTR3B } = require('../controllers/gst.controller');

router.use(authenticate, requireBusiness);

// Returns JSON download — client triggers file save
router.get('/gstr1', async (req, res, next) => {
  try {
    // Reuse gst controller but return as file download
    req.isExport = true;
    const { period } = req.query;
    if (!period) return res.status(400).json({ success: false, error: 'Period required' });
    
    // Fetch from DB if already generated
    const prisma = require('../../config/prisma');
    const ret = await prisma.gstReturn.findUnique({
      where: {
        businessId_returnType_period: {
          businessId: req.user.businessId,
          returnType: 'GSTR1',
          period,
        },
      },
    });
    if (!ret?.jsonPayload) {
      return res.status(404).json({ success: false, error: 'Generate GSTR-1 first before downloading.' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="GSTR1_${period}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret.jsonPayload, null, 2));
  } catch (err) { next(err); }
});

router.get('/gstr3b', async (req, res, next) => {
  try {
    const { period } = req.query;
    if (!period) return res.status(400).json({ success: false, error: 'Period required' });
    
    const prisma = require('../../config/prisma');
    const ret = await prisma.gstReturn.findUnique({
      where: {
        businessId_returnType_period: {
          businessId: req.user.businessId,
          returnType: 'GSTR3B',
          period,
        },
      },
    });
    if (!ret?.jsonPayload) {
      return res.status(404).json({ success: false, error: 'Generate GSTR-3B first before downloading.' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="GSTR3B_${period}.json"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(ret.jsonPayload, null, 2));
  } catch (err) { next(err); }
});

module.exports = router;
