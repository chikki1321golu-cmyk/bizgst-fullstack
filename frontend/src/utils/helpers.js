/**
 * Utility functions
 */

/** Format number as Indian Rupees */
export const fmt = (n) =>
  '₹' + (parseFloat(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** Format date for display */
export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

/** Convert JS Date to MMYYYY period string */
export const dateToPeriod = (date = new Date()) => {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${m}${date.getFullYear()}`;
};

/** Period to human label */
export const periodLabel = (period) => {
  if (!period || period.length !== 6) return period;
  const m = parseInt(period.slice(0, 2)) - 1;
  const y = parseInt(period.slice(2));
  return new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};

/** Validate Indian GSTIN */
export const validateGSTIN = (gstin) => {
  if (!gstin) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.toUpperCase().trim());
};

/** Today in YYYY-MM-DD for date inputs */
export const todayISO = () => new Date().toISOString().split('T')[0];

/** Download a blob as a file */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href    = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** Extract validation errors from axios error response */
export const extractErrors = (err) => {
  if (err.response?.data?.errors) {
    return err.response.data.errors.map(e => e.msg).join(', ');
  }
  return err.response?.data?.error || err.message || 'An error occurred';
};

/** Indian state options for dropdowns */
export const INDIAN_STATES = [
  { code: '27', name: 'Maharashtra' },
  { code: '24', name: 'Gujarat' },
  { code: '07', name: 'Delhi' },
  { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '08', name: 'Rajasthan' },
  { code: '19', name: 'West Bengal' },
  { code: '06', name: 'Haryana' },
  { code: '36', name: 'Telangana' },
  { code: '32', name: 'Kerala' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '20', name: 'Jharkhand' },
  { code: '22', name: 'Chhattisgarh' },
];

export const GST_RATES = [0, 5, 12, 18, 28];
