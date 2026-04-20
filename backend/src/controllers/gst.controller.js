/**
 * GST Controller
 * Computes summaries and generates return payloads
 */
const prisma = require('../../config/prisma');
const {
  generateGSTR1Payload,
  generateGSTR3BPayload,
  dateToPeriod,
} = require('../services/gst.engine');
const { createError } = require('../middleware/error.middleware');

/**
 * GET /api/gst/summary?period=032025
 * Dashboard-level summary for the business
 */
async function getGSTSummary(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { period } = req.query;

    // Default to current month if no period given
    const now   = new Date();
    const p     = period || dateToPeriod(now);
    const month = parseInt(p.slice(0, 2)) - 1;
    const year  = parseInt(p.slice(2));

    const dateFilter = {
      gte: new Date(year, month, 1),
      lte: new Date(year, month + 1, 0, 23, 59, 59),
    };

    const where = { businessId, invoiceDate: dateFilter, status: { not: 'CANCELLED' } };

    const [sales, purchases] = await Promise.all([
      prisma.invoice.findMany({ where: { ...where, invoiceType: 'SALE' } }),
      prisma.invoice.findMany({ where: { ...where, invoiceType: 'PURCHASE' } }),
    ]);

    const totalSales     = +sales.reduce((a, s) => a + s.totalAmount,   0).toFixed(2);
    const totalPurchases = +purchases.reduce((a, p) => a + p.totalAmount, 0).toFixed(2);
    const outputGST      = +sales.reduce((a, s) => a + s.cgst + s.sgst + s.igst, 0).toFixed(2);
    const itcAvailable   = +purchases.filter(p => p.itcEligible).reduce((a, p) => a + p.itcCgst + p.itcSgst + p.itcIgst, 0).toFixed(2);
    const blockedITC     = +purchases.filter(p => !p.itcEligible).reduce((a, p) => a + p.cgst + p.sgst + p.igst, 0).toFixed(2);
    const netPayable     = Math.max(0, +(outputGST - itcAvailable).toFixed(2));

    res.json({
      success: true,
      data: {
        period: p,
        totalSales,
        totalPurchases,
        outputGST,
        itcAvailable,
        blockedITC,
        netPayable,
        salesCount:    sales.length,
        purchasesCount: purchases.length,
        // Breakdown
        cgstPayable: +sales.reduce((a,s) => a+s.cgst, 0).toFixed(2),
        sgstPayable: +sales.reduce((a,s) => a+s.sgst, 0).toFixed(2),
        igstPayable: +sales.reduce((a,s) => a+s.igst, 0).toFixed(2),
        b2bCount:    sales.filter(s => s.supplyType === 'B2B').length,
        b2cCount:    sales.filter(s => s.supplyType !== 'B2B').length,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gst/gstr1?period=032025
 */
async function getGSTR1(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { period }  = req.query;
    if (!period) throw createError('Period is required (format: MMYYYY)', 400);

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw createError('Business not found', 404);

    const month = parseInt(period.slice(0, 2)) - 1;
    const year  = parseInt(period.slice(2));

    const invoices = await prisma.invoice.findMany({
      where: {
        businessId,
        invoiceType:  'SALE',
        status:       { not: 'CANCELLED' },
        invoiceDate:  { gte: new Date(year, month, 1), lte: new Date(year, month + 1, 0, 23, 59, 59) },
      },
      include: { party: true, items: true },
    });

    const payload = generateGSTR1Payload(business.gstin, period, invoices);

    // Persist/update in gst_returns table
    await prisma.gstReturn.upsert({
      where:  { businessId_returnType_period: { businessId, returnType: 'GSTR1', period } },
      create: { businessId, returnType: 'GSTR1', period, status: 'READY', jsonPayload: payload },
      update: { status: 'READY', jsonPayload: payload, updatedAt: new Date() },
    });

    res.json({ success: true, data: { period, invoiceCount: invoices.length, payload } });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/gst/gstr3b?period=032025
 */
async function getGSTR3B(req, res, next) {
  try {
    const businessId = req.user.businessId;
    const { period }  = req.query;
    if (!period) throw createError('Period is required (format: MMYYYY)', 400);

    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw createError('Business not found', 404);

    const month = parseInt(period.slice(0, 2)) - 1;
    const year  = parseInt(period.slice(2));
    const dateFilter = { gte: new Date(year, month, 1), lte: new Date(year, month + 1, 0, 23, 59, 59) };

    const [sales, purchases] = await Promise.all([
      prisma.invoice.findMany({
        where: { businessId, invoiceType: 'SALE',     status: { not: 'CANCELLED' }, invoiceDate: dateFilter },
      }),
      prisma.invoice.findMany({
        where: { businessId, invoiceType: 'PURCHASE', status: { not: 'CANCELLED' }, invoiceDate: dateFilter },
      }),
    ]);

    const payload = generateGSTR3BPayload(business.gstin, period, sales, purchases);

    await prisma.gstReturn.upsert({
      where:  { businessId_returnType_period: { businessId, returnType: 'GSTR3B', period } },
      create: { businessId, returnType: 'GSTR3B', period, status: 'READY', jsonPayload: payload },
      update: { status: 'READY', jsonPayload: payload, updatedAt: new Date() },
    });

    res.json({ success: true, data: { period, payload } });
  } catch (err) {
    next(err);
  }
}

module.exports = { getGSTSummary, getGSTR1, getGSTR3B };
