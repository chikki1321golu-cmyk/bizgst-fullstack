const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { listSales, createSale, getSale, cancelSale } = require('../controllers/sales.controller');
const { authenticate, requireBusiness } = require('../middleware/auth.middleware');

router.use(authenticate, requireBusiness);

router.get('/', listSales);
router.get('/:id', getSale);
router.delete('/:id', cancelSale);

router.post('/',
  [
    body('invoiceDate').isISO8601().withMessage('Valid invoice date is required'),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Quantity must be positive'),
    body('items.*.unitPrice').isFloat({ gt: 0 }).withMessage('Unit price must be positive'),
    body('items.*.gstRate').optional().isIn([0, 5, 12, 18, 28]).withMessage('Invalid GST rate'),
  ],
  createSale
);

module.exports = router;
