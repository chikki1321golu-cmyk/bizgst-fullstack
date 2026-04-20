const { validationResult } = require('express-validator');
const prisma = require('../../config/prisma');
const { createError } = require('../middleware/error.middleware');

async function listProducts(req, res, next) {
  try {
    const products = await prisma.product.findMany({
      where: { businessId: req.user.businessId, isActive: true },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: products });
  } catch (err) { next(err); }
}

async function createProduct(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });

    const { name, hsnCode, gstRate, unit, basePrice, description } = req.body;

    const valid = [0, 5, 12, 18, 28];
    if (!valid.includes(parseFloat(gstRate))) {
      return res.status(422).json({ success: false, error: 'GST rate must be 0, 5, 12, 18, or 28.' });
    }

    const product = await prisma.product.create({
      data: {
        businessId: req.user.businessId,
        name, hsnCode, gstRate: parseFloat(gstRate),
        unit: unit || 'Nos',
        basePrice: parseFloat(basePrice || 0),
        description: description || null,
      },
    });
    res.status(201).json({ success: true, data: product });
  } catch (err) { next(err); }
}

async function updateProduct(req, res, next) {
  try {
    const product = await prisma.product.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!product) throw createError('Product not found', 404);

    const updated = await prisma.product.update({
      where: { id: product.id },
      data: req.body,
    });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

async function deleteProduct(req, res, next) {
  try {
    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });
    res.json({ success: true, message: 'Product deactivated' });
  } catch (err) { next(err); }
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };
