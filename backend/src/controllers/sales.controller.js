/**
 * Sales Controller
 * All sale invoice CRUD + GST-aware creation
 */
const { validationResult } = require('express-validator');
const prisma = require('../../config/prisma');
const {
  isInterstateSupply,
  classifySupplyType,
  calculateInvoiceGST,
  validateGSTIN,
} = require('../services/gst.engine');
const { createError } = require('../middleware/error.middleware');

/**
 * List all sales for the business, optionally filtered by period
 * GET /api/sales?period=032025&page=1&limit=50
 */
async function listSales(req, res, next) {
  try {
    const { period, page = 1, limit = 50, search } = req.query;
    const businessId = req.user.businessId;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build date filter from period (MMYYYY)
    let dateFilter = {};
    if (period && period.length === 6) {
      const month = parseInt(period.slice(0, 2)) - 1;
      const year  = parseInt(period.slice(2));
      const from  = new Date(year, month, 1);
      const to    = new Date(year, month + 1, 0, 23, 59, 59);
      dateFilter  = { gte: from, lte: to };
    }

    const where = {
      businessId,
      invoiceType: 'SALE',
      status: { not: 'CANCELLED' },
      ...(Object.keys(dateFilter).length && { invoiceDate: dateFilter }),
      ...(search && {
        OR: [
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { party: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          party:  { select: { id: true, name: true, gstin: true, stateCode: true } },
          items:  true,
        },
        orderBy: { invoiceDate: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({
      success: true,
      data: invoices,
      meta: {
        total,
        page:       parseInt(page),
        limit:      parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new sale invoice
 * POST /api/sales
 * Body: { partyId?, partyName?, partyGstin?, partyStateCode?, items: [...], invoiceDate }
 */
async function createSale(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const businessId = req.user.businessId;
    const { partyId, partyName, partyGstin, partyStateCode, items, invoiceDate, notes } = req.body;

    // Validate GSTIN if provided
    if (partyGstin && !validateGSTIN(partyGstin)) {
      return res.status(422).json({ success: false, error: 'Invalid GSTIN format.' });
    }

    // Get business to determine seller state
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw createError('Business not found', 404);

    // Resolve or create party
    let party;
    if (partyId) {
      party = await prisma.party.findUnique({ where: { id: partyId } });
      if (!party) throw createError('Customer not found', 404);
    } else if (partyName) {
      // Auto-create party for quick entry
      party = await prisma.party.create({
        data: {
          businessId,
          name:      partyName,
          gstin:     partyGstin || null,
          stateCode: partyStateCode || business.stateCode,
          type:      'CUSTOMER',
        },
      });
    }

    const buyerStateCode = party?.stateCode || partyStateCode || business.stateCode;
    const interstate = isInterstateSupply(business.stateCode, buyerStateCode);

    // Enrich items with product details from DB
    const productIds = items.filter(i => i.productId).map(i => i.productId);
    const products   = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds }, businessId } })
      : [];
    const productMap = Object.fromEntries(products.map(p => [p.id, p]));

    // Build enriched items for GST calculation
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

    if (enrichedItems.some(i => !i.hsnCode)) {
      return res.status(422).json({ success: false, error: 'HSN code is required for all items.' });
    }

    // Run GST engine
    const { items: calcItems, summary } = calculateInvoiceGST(enrichedItems, interstate);

    // Classify supply type
    const supplyType = classifySupplyType(party?.gstin, summary.taxableAmount, interstate);

    // Generate invoice number
    const lastInvoice = await prisma.invoice.findFirst({
      where: { businessId, invoiceType: 'SALE' },
      orderBy: { createdAt: 'desc' },
      select: { invoiceNumber: true },
    });
    const lastNum = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.replace(/\D/g, '')) || 0
      : 0;
    const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, '0')}`;

    // Create invoice in DB (single transaction)
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          businessId,
          partyId:       party?.id || null,
          invoiceNumber,
          invoiceDate:   new Date(invoiceDate),
          invoiceType:   'SALE',
          supplyType,
          isInterstate:  interstate,
          taxableAmount: summary.taxableAmount,
          cgst:          summary.cgst,
          sgst:          summary.sgst,
          igst:          summary.igst,
          totalAmount:   summary.grandTotal,
          notes:         notes || null,
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
      return inv;
    });

    res.status(201).json({
      success: true,
      message: `Invoice ${invoiceNumber} created`,
      data: { invoice, summary },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get single invoice
 * GET /api/sales/:id
 */
async function getSale(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId, invoiceType: 'SALE' },
      include: {
        party:    true,
        items:    { include: { product: { select: { name: true, hsnCode: true } } } },
        business: { select: { name: true, gstin: true, address: true, stateCode: true, stateName: true } },
      },
    });

    if (!invoice) throw createError('Invoice not found', 404);
    res.json({ success: true, data: invoice });
  } catch (err) {
    next(err);
  }
}

/**
 * Cancel an invoice (soft delete)
 * DELETE /api/sales/:id
 */
async function cancelSale(req, res, next) {
  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId, invoiceType: 'SALE' },
    });
    if (!invoice) throw createError('Invoice not found', 404);
    if (invoice.status === 'CANCELLED') throw createError('Invoice already cancelled');

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, message: 'Invoice cancelled' });
  } catch (err) {
    next(err);
  }
}

module.exports = { listSales, createSale, getSale, cancelSale };
