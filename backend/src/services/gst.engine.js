/**
 * BizGST — GST Engine
 * ─────────────────────────────────────────────────────────────
 * All GST calculation logic lives here. Frontend NEVER computes
 * tax — it only displays what this engine returns.
 *
 * Indian GST Rules implemented:
 * 1. Intrastate supply → CGST (50%) + SGST (50%)
 * 2. Interstate supply → IGST (100%)
 * 3. B2B invoice → customer GSTIN present, reported invoice-wise in GSTR-1
 * 4. B2CS (large) → consumer, taxable value ≥ ₹2,50,000, reported invoice-wise
 * 5. B2C (small) → consumer, taxable value < ₹2,50,000, consolidated in GSTR-1
 * 6. ITC blocked if supplier has no GSTIN
 * 7. RCM: buyer pays tax, not supplier
 */

const BUSINESS_STATE_CODE = process.env.BUSINESS_STATE_CODE || '27'; // Maharashtra default

/**
 * Determine if supply is interstate
 * @param {string} sellerStateCode - e.g. "27"
 * @param {string} buyerStateCode  - e.g. "24"
 */
function isInterstateSupply(sellerStateCode, buyerStateCode) {
  if (!buyerStateCode) return false;
  return sellerStateCode.trim() !== buyerStateCode.trim();
}

/**
 * Classify supply type for GSTR-1 reporting
 * @param {string|null} partyGstin   - Customer GSTIN (null for B2C)
 * @param {number}      taxableValue - Pre-tax amount
 * @param {boolean}     isInterstate
 */
function classifySupplyType(partyGstin, taxableValue, isInterstate) {
  if (partyGstin && partyGstin.length === 15) {
    return 'B2B';
  }
  // B2C threshold: ₹2,50,000 for interstate (invoice-wise reporting)
  if (isInterstate && taxableValue >= 250000) {
    return 'B2CS'; // Large B2C — needs invoice-wise reporting
  }
  return 'B2C'; // Small B2C — consolidated reporting
}

/**
 * Core GST calculation for a single line item
 * @param {number} baseAmount   - Price × Quantity (before tax)
 * @param {number} gstRate      - GST rate (0, 5, 12, 18, 28)
 * @param {boolean} isInterstate
 * @param {number} discount     - Discount amount (default 0)
 */
function calculateItemGST(baseAmount, gstRate, isInterstate, discount = 0) {
  const taxableAmount = parseFloat((baseAmount - discount).toFixed(2));

  if (taxableAmount < 0) {
    throw new Error('Taxable amount cannot be negative');
  }

  const totalGst = parseFloat((taxableAmount * gstRate / 100).toFixed(2));

  let cgst = 0, sgst = 0, igst = 0;

  if (gstRate === 0) {
    // Exempt / zero-rated — no tax
    return { taxableAmount, cgst: 0, sgst: 0, igst: 0, totalGst: 0, lineTotal: taxableAmount };
  }

  if (isInterstate) {
    // Interstate → Full IGST
    igst = totalGst;
  } else {
    // Intrastate → CGST (half) + SGST (half)
    cgst = parseFloat((totalGst / 2).toFixed(2));
    sgst = parseFloat((totalGst - cgst).toFixed(2)); // Handles rounding: sgst gets the remainder
  }

  return {
    taxableAmount,
    cgst,
    sgst,
    igst,
    totalGst,
    lineTotal: parseFloat((taxableAmount + totalGst).toFixed(2)),
  };
}

/**
 * Calculate GST for a full invoice (multiple items)
 * @param {Array}   items       - [{productId, quantity, unitPrice, gstRate, discount?, description, hsnCode}]
 * @param {boolean} isInterstate
 */
function calculateInvoiceGST(items, isInterstate) {
  let totalTaxable = 0, totalCgst = 0, totalSgst = 0, totalIgst = 0;

  const calculatedItems = items.map((item) => {
    const baseAmount = parseFloat((item.quantity * item.unitPrice).toFixed(2));
    const tax = calculateItemGST(baseAmount, item.gstRate, isInterstate, item.discount || 0);

    totalTaxable += tax.taxableAmount;
    totalCgst    += tax.cgst;
    totalSgst    += tax.sgst;
    totalIgst    += tax.igst;

    return { ...item, ...tax };
  });

  // Round to 2 decimal places for final totals (avoid floating point drift)
  totalTaxable = parseFloat(totalTaxable.toFixed(2));
  totalCgst    = parseFloat(totalCgst.toFixed(2));
  totalSgst    = parseFloat(totalSgst.toFixed(2));
  totalIgst    = parseFloat(totalIgst.toFixed(2));

  const totalGst   = parseFloat((totalCgst + totalSgst + totalIgst).toFixed(2));
  const grandTotal = parseFloat((totalTaxable + totalGst).toFixed(2));

  return {
    items: calculatedItems,
    summary: {
      taxableAmount: totalTaxable,
      cgst: totalCgst,
      sgst: totalSgst,
      igst: totalIgst,
      totalGst,
      grandTotal,
    },
  };
}

/**
 * Calculate Input Tax Credit eligibility for a purchase
 * ITC is blocked when:
 * - Supplier has no GSTIN (unregistered dealer)
 * - Purchase is for personal/exempt use
 * - Goods/services in GST blocked list (Section 17(5))
 *
 * @param {string|null} supplierGstin
 * @param {number} cgst
 * @param {number} sgst
 * @param {number} igst
 * @param {boolean} isBlocked - Set true for blocked categories
 */
function calculateITC(supplierGstin, cgst, sgst, igst, isBlocked = false) {
  // No GSTIN = unregistered supplier = ITC not available
  const hasValidGstin = supplierGstin && supplierGstin.length === 15;

  if (!hasValidGstin || isBlocked) {
    return {
      eligible: false,
      itcCgst: 0,
      itcSgst: 0,
      itcIgst: 0,
      totalItc: 0,
      reason: !hasValidGstin
        ? 'Supplier GSTIN not provided — ITC not available (unregistered dealer)'
        : 'Blocked ITC category (Section 17(5) of CGST Act)',
    };
  }

  return {
    eligible: true,
    itcCgst: cgst,
    itcSgst: sgst,
    itcIgst: igst,
    totalItc: parseFloat((cgst + sgst + igst).toFixed(2)),
    reason: 'Eligible for ITC',
  };
}

/**
 * Generate GSTR-1 payload (GST portal compatible format)
 * @param {string} gstin       - Business GSTIN
 * @param {string} period      - "032025" format
 * @param {Array}  invoices    - Sale invoices for the period
 */
function generateGSTR1Payload(gstin, period, invoices) {
  const sales = invoices.filter(inv => inv.invoiceType === 'SALE' && inv.status === 'ACTIVE');

  // ── B2B Invoices (Section 4A) ─────────────────
  const b2bMap = {};
  sales.filter(s => s.supplyType === 'B2B').forEach(s => {
    const ctin = s.party?.gstin;
    if (!ctin) return;
    if (!b2bMap[ctin]) b2bMap[ctin] = { ctin, inv: [] };

    b2bMap[ctin].inv.push({
      inum: s.invoiceNumber,
      idt:  formatGSTDate(s.invoiceDate),
      val:  s.totalAmount,
      pos:  s.party?.stateCode || '27',
      rchrg: s.isRcm ? 'Y' : 'N',
      inv_typ: 'R', // Regular
      itms: s.items.map((item, idx) => ({
        num: idx + 1,
        itm_det: {
          ty:     'G', // Goods (use 'S' for services)
          hsn_sc: item.hsnCode,
          txval:  item.taxableAmount,
          irt:    0,
          iamt:   item.igst,
          crt:    s.isInterstate ? 0 : item.gstRate / 2,
          camt:   item.cgst,
          srt:    s.isInterstate ? 0 : item.gstRate / 2,
          samt:   item.sgst,
          csrt:   0,
          csamt:  0,
        },
      })),
    });
  });

  // ── B2CS (Large B2C ≥₹2.5L) — Section 5 ──────
  const b2csInvoices = sales.filter(s => s.supplyType === 'B2CS');

  // ── B2C Small — Consolidated by rate + state ──
  const b2cRateMap = {};
  sales.filter(s => s.supplyType === 'B2C').forEach(s => {
    s.items.forEach(item => {
      const key = `${s.party?.stateCode || '27'}_${item.gstRate}`;
      if (!b2cRateMap[key]) b2cRateMap[key] = {
        pos:   s.party?.stateCode || '27',
        sply_ty: 'INTER',
        rt:    item.gstRate,
        txval: 0,
        iamt:  0,
        camt:  0,
        samt:  0,
        csamt: 0,
      };
      b2cRateMap[key].txval += item.taxableAmount;
      b2cRateMap[key].iamt  += item.igst;
      b2cRateMap[key].camt  += item.cgst;
      b2cRateMap[key].samt  += item.sgst;
    });
  });

  // ── HSN Summary ───────────────────────────────
  const hsnMap = {};
  sales.forEach(s => {
    s.items.forEach(item => {
      if (!hsnMap[item.hsnCode]) hsnMap[item.hsnCode] = {
        hsn_sc: item.hsnCode,
        desc:   item.description,
        uqc:    'NOS',
        cnt:    0,
        txval:  0,
        iamt:   0,
        camt:   0,
        samt:   0,
        csamt:  0,
      };
      hsnMap[item.hsnCode].cnt   += item.quantity;
      hsnMap[item.hsnCode].txval += item.taxableAmount;
      hsnMap[item.hsnCode].iamt  += item.igst;
      hsnMap[item.hsnCode].camt  += item.cgst;
      hsnMap[item.hsnCode].samt  += item.sgst;
    });
  });

  // Round all accumulated values
  Object.values(hsnMap).forEach(h => {
    h.txval = +h.txval.toFixed(2);
    h.iamt  = +h.iamt.toFixed(2);
    h.camt  = +h.camt.toFixed(2);
    h.samt  = +h.samt.toFixed(2);
  });

  const totalTurnover = +sales.reduce((a, s) => a + s.taxableAmount, 0).toFixed(2);

  return {
    gstin,
    fp:     period,
    gt:     totalTurnover,
    cur_gt: totalTurnover,
    b2b:    Object.values(b2bMap),
    b2cs:   b2csInvoices.map(s => ({
      inum: s.invoiceNumber,
      idt:  formatGSTDate(s.invoiceDate),
      val:  s.totalAmount,
      pos:  s.party?.stateCode || '27',
      txval: s.taxableAmount,
      iamt: s.igst,
      camt: s.cgst,
      samt: s.sgst,
      csamt: 0,
    })),
    b2cl:   Object.values(b2cRateMap).map(r => ({
      ...r,
      txval: +r.txval.toFixed(2),
      iamt:  +r.iamt.toFixed(2),
      camt:  +r.camt.toFixed(2),
      samt:  +r.samt.toFixed(2),
    })),
    hsn: { data: Object.values(hsnMap) },
  };
}

/**
 * Generate GSTR-3B payload (summary return)
 * @param {string} gstin
 * @param {string} period
 * @param {Array}  sales     - Sale invoices
 * @param {Array}  purchases - Purchase invoices
 */
function generateGSTR3BPayload(gstin, period, sales, purchases) {
  const activeSales = sales.filter(s => s.status === 'ACTIVE');
  const activePurchases = purchases.filter(p => p.status === 'ACTIVE');

  // 3.1 — Outward supplies tax
  const outIgst  = +activeSales.reduce((a, s) => a + s.igst,  0).toFixed(2);
  const outCgst  = +activeSales.reduce((a, s) => a + s.cgst,  0).toFixed(2);
  const outSgst  = +activeSales.reduce((a, s) => a + s.sgst,  0).toFixed(2);
  const outTxval = +activeSales.reduce((a, s) => a + s.taxableAmount, 0).toFixed(2);

  // 4 — ITC available
  const eligPurch = activePurchases.filter(p => p.itcEligible);
  const itcIgst = +eligPurch.reduce((a, p) => a + p.itcIgst, 0).toFixed(2);
  const itcCgst = +eligPurch.reduce((a, p) => a + p.itcCgst, 0).toFixed(2);
  const itcSgst = +eligPurch.reduce((a, p) => a + p.itcSgst, 0).toFixed(2);

  // Ineligible ITC (blocked)
  const ineligPurch = activePurchases.filter(p => !p.itcEligible);
  const ineligCgst = +ineligPurch.reduce((a, p) => a + p.cgst, 0).toFixed(2);
  const ineligSgst = +ineligPurch.reduce((a, p) => a + p.sgst, 0).toFixed(2);
  const ineligIgst = +ineligPurch.reduce((a, p) => a + p.igst, 0).toFixed(2);

  // Net payable after ITC
  const netIgst = Math.max(0, +(outIgst - itcIgst).toFixed(2));
  const netCgst = Math.max(0, +(outCgst - itcCgst).toFixed(2));
  const netSgst = Math.max(0, +(outSgst - itcSgst).toFixed(2));

  return {
    gstin,
    ret_period: period,
    sup_details: {
      osup_det: {
        txval: outTxval,
        iamt:  outIgst,
        camt:  outCgst,
        samt:  outSgst,
        csamt: 0,
      },
      osup_zero:     { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
      osup_nil_exmp: { txval: 0 },
      isup_rev:      { txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 },
      osup_nongst:   { txval: 0 },
    },
    itc_elg: {
      itc_avl: [
        { ty: 'IMPG', iamt: 0,       camt: 0,       samt: 0,       csamt: 0 },
        { ty: 'ISRC', iamt: itcIgst, camt: itcCgst, samt: itcSgst, csamt: 0 },
      ],
      itc_inelg: [
        { ty: 'RUL', iamt: ineligIgst, camt: ineligCgst, samt: ineligSgst, csamt: 0 },
      ],
      itc_net: {
        iamt: itcIgst,
        camt: itcCgst,
        samt: itcSgst,
        csamt: 0,
      },
    },
    intr_ltfee: {
      intr_details: { iamt: 0, camt: 0, samt: 0, csamt: 0 },
    },
    // Computed summary (not in official format — for UI display)
    _computed: {
      totalOutputTax: +(outIgst + outCgst + outSgst).toFixed(2),
      totalITC:       +(itcIgst + itcCgst + itcSgst).toFixed(2),
      netPayable:     +(netIgst + netCgst + netSgst).toFixed(2),
      cashPayable:    +(netIgst + netCgst + netSgst).toFixed(2),
    },
  };
}

/**
 * Validate GSTIN format
 * Format: 2-digit state code + 5 uppercase letters + 4 digits + 1 uppercase + 1 = '1'|alpha + 'Z' + 1 alphanumeric
 */
function validateGSTIN(gstin) {
  if (!gstin) return false;
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.toUpperCase().trim());
}

/**
 * Format date to GST portal date format DD-MM-YYYY
 */
function formatGSTDate(date) {
  const d = new Date(date);
  const day   = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Convert a JS Date to GST period string "MMYYYY"
 */
function dateToPeriod(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year  = d.getFullYear();
  return `${month}${year}`;
}

module.exports = {
  isInterstateSupply,
  classifySupplyType,
  calculateItemGST,
  calculateInvoiceGST,
  calculateITC,
  generateGSTR1Payload,
  generateGSTR3BPayload,
  validateGSTIN,
  formatGSTDate,
  dateToPeriod,
};
