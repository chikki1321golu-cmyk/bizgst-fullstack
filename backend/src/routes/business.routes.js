const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getBusinessProfile, createBusiness, updateBusiness } = require('../controllers/business.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', getBusinessProfile);

router.post('/',
  [
    body('name').notEmpty().withMessage('Business name is required'),
    body('gstin').notEmpty().withMessage('GSTIN is required'),
  ],
  createBusiness
);

router.put('/', updateBusiness);

module.exports = router;
