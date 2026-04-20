const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { listPurchases, createPurchase, getPurchase } = require('../controllers/purchases.controller');
const { authenticate, requireBusiness } = require('../middleware/auth.middleware');

router.use(authenticate, requireBusiness);
router.get('/', listPurchases);
router.get('/:id', getPurchase);
router.post('/',
  [
    body('invoiceDate').isISO8601().withMessage('Valid invoice date required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.quantity').isFloat({ gt: 0 }),
    body('items.*.unitPrice').isFloat({ gt: 0 }),
  ],
  createPurchase
);
module.exports = router;
