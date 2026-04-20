const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { listProducts, createProduct, updateProduct, deleteProduct } = require('../controllers/products.controller');
const { authenticate, requireBusiness } = require('../middleware/auth.middleware');

router.use(authenticate, requireBusiness);
router.get('/', listProducts);
router.post('/',
  [
    body('name').notEmpty().withMessage('Product name required'),
    body('hsnCode').notEmpty().withMessage('HSN code required'),
    body('gstRate').isIn([0, 5, 12, 18, 28]).withMessage('Invalid GST rate'),
  ],
  createProduct
);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
module.exports = router;
