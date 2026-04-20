/**
 * Purchases Controller
 * Records vendor invoices and computes ITC eligibility
 */
const { validationResult } = require('express-validator');
const prisma = require('../../config/prisma');
const {
  isInterstateSupply,
  calculateInvoiceGST,
  calculateITC,
  validateGSTIN,
} = require('../services/gst.engine');
const { createError } = require('../middleware/error.middleware');

/**
 * List all purchases
 * GET /api/purchases?period=032025
 */
async function listPurchases(req, res, next) {
  try {
    const { period, page = 1, limit = 50 } = req.query;
    const businessId = req.user.businessId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let dateFilter = {};
    if (period && period.length === 6) {
      const month = parseInt(period.slice(0, 2)) - 1;
      const year  = parseInt(period.slice(2));
      dateFilter  = { gte: new Date(year, month, 1), lte: new Date(year, month + 1, 0, 23, 59, 59) };
    }

    const where = {
      businessId,
      invoiceType: 'PURCHASE',
      status: { not: 'CANCELLED' },
      ...(Object.keys(dateFilter).length && { invoiceDate: dateFilter }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: { party: { select: { id: true, name: true, gstin: true } }, items: true },
        orderBy: { invoiceDate: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ success: true, data: invoices, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a purchase invoice
 * POST /api/purchases
 */
async function createPurchase(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const businessId = req.user.businessId;
    const {
      vendorId, vendorName, vendorGstin, vendorStateCode,
      invoiceNumber: supplierInvNo, invoiceDate,
      items, notes, isRcm = false,
    } = req.body;

    if (vendorGstin && !validateGSTIN(vendorGstin)) {
      return res.status(422).json({ success: false, error: 'Invalid supplier GSTIN format.' });
    }

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw createError('Business not found', 404);

    // Resolve or create vendor
    let vendor;
    if (vendorId) {
      vendor = await prisma.party.findUnique({ where: { id: vendorId } });
    } else if (vendorName) {
      vendor = await prisma.party.create({
        data: {
          businessId,
          name:      vendorName,
          gstin:     vendorGstin || null,
          stateCode: vendorStateCode || business.stateCode,
          type:      'VENDOR',
        },
      });
    }

    const interstate = isInterstateSupply(business.stateCode, vendor?.stateCode || vendorStateCode || business.stateCode);

    // Enrich items
    const productIds = items.filter(i => i.productId).map(i => i.productId);
    const products   = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds }, businessId } })
      : [];
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    const enrichedItems = items.map(item => {
      const product = item.productId ? productMap[item.productId] : null;
      return {
        productId:   item.productId || null,
        description: item.description || product?.name || 'Item',
        hsnCode:     item.hsnCode    || product?.hsnCode || '',
        quantity:    parseFloat(item.quantity),
        unit:        item.unit       || product?.unit || 'Nos',
        unitPrice:   parseFloat(item.unitPrice),
        gstRate:     parseFloat(item.gstRate !== undefined ? item.gstRate : (product?.gstRate ?? 18)),
        discount:    parseFloat(item.discount || 0),
      };
    });

    const { items: calcItems, summary } = calculateInvoiceGST(enrichedItems, interstate);

    // Compute ITC eligibility
    const itc = calculateITC(vendor?.gstin || vendorGstin, summary.cgst, summary.sgst, summary.igst);

    // Auto-generate internal reference number
    const lastPurchase = await prisma.invoice.findFirst({
      where: { businessId, invoiceType: 'PURCHASE' },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    const lastNum = lastPurchase
      ? parseInt(lastPurchase.invoiceNumber.replace(/\D/g, '')) || 0
      : 0;
    const internalRefNo = `PUR-${String(lastNum + 1).padStart(4, '0')}`;

    const invoice = await prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          businessId,
          partyId:       vendor?.id || null,
          invoiceNumber: internalRefNo,
          invoiceDate:   new Date(invoiceDate),
          invoiceType:   'PURCHASE',
          supplyType:    'B2B', // Purchases are always B2B for ITC
          isInterstate:  interstate,
          isRcm,
          taxableAmount: summary.taxableAmount,
          cgst:          summary.cgst,
          sgst:          summary.sgst,
          igst:          summary.igst,
          totalAmount:   summary.grandTotal,
          itcEligible:   itc.eligible,
          itcCgst:       itc.itcCgst,
          itcSgst:       itc.itcSgst,
          itcIgst:       itc.itcIgst,
          notes:         notes || supplierInvNo || null,
          items: {
            create: calcItems.map(item => ({
              productId:    item.productId,
              description:  item.description,
              hsnCode:      item.hsnCode,
              quantity:     item.quantity,
              unit:         item.unit,
              unitPrice:    item.unitPrice,
              discount:     item.discount,
              taxableAmount:item.taxableAmount,
              gstRate:      item.gstRate,
              cgst:         item.cgst,
              sgst:         item.sgst,
              igst:         item.igst,
              totalAmount:  item.lineTotal,
            })),
          },
        },
        include: { items: true, party: true },
      });
    });

    res.status(201).json({
      success: true,
      message: `Purchase ${internalRefNo} recorded`,
      data: { invoice, itc, summary },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single purchase
 */
async function getPurchase(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId, invoiceType: 'PURCHASE' },
      include: { party: true, items: true },
    });
    if (!invoice) throw createError('Purchase not found', 404);
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPurchases, createPurchase, getPurchase };
