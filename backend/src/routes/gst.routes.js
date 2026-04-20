const express = require('express');
const router = express.Router();
const { getGSTSummary, getGSTR1, getGSTR3B } = require('../controllers/gst.controller');
const { authenticate, requireBusiness } = require('../middleware/auth.middleware');

router.use(authenticate, requireBusiness);
router.get('/summary', getGSTSummary);
router.get('/gstr1',   getGSTR1);
router.get('/gstr3b',  getGSTR3B);
module.exports = router;
