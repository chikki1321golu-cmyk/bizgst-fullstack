/**
 * Purchases — Add Modal + List
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { purchasesAPI } from '../../services/api';
import { usePurchases, useProducts, usePeriod } from '../../hooks/useData';
import { validateGSTIN, INDIAN_STATES, todayISO, fmt, fmtDate, periodLabel, extractErrors, GST_RATES } from '../../utils/helpers';

// ── Add Purchase Modal ─────────────────────────────────────────
export function AddPurchaseModal({ onClose, onSuccess }) {
  const { data: products = [] } = useProducts();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    vendorName: '', vendorGstin: '', vendorStateCode: '27',
    invoiceDate: todayISO(), notes: '',
  });
  const [items, setItems] = useState([{ description: '', hsnCode: '', quantity: 1, unitPrice: '', gstRate: 18 }]);
  const [gstinStatus, setGstinStatus] = useState('');
  const [preview, setPreview] = useState(null);

  function handleGSTIN(v) {
    const val = v.toUpperCase();
    setForm(f => ({...f, vendorGstin: val}));
    if (!val) setGstinStatus('');
    else if (val.length === 15 && validateGSTIN(val)) setGstinStatus('valid');
    else setGstinStatus('invalid');
  }

  function handleItemChange(idx, field, value) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = {...next[idx], [field]: value};
      if (field === 'productId' && value) {
        const p = (products || []).find(x => x.id === value);
        if (p) { next[idx].hsnCode = p.hsnCode; next[idx].gstRate = p.gstRate; next[idx].description = p.name; }
      }
      // Live preview for first item
      const i = next[0];
      if (i.quantity && i.unitPrice) {
        const taxable = parseFloat(i.quantity) * parseFloat(i.unitPrice);
        const gst = taxable * parseFloat(i.gstRate) / 100;
        const itcEligible = gstinStatus === 'valid' || validateGSTIN(form.vendorGstin);
        setPreview({ taxable, gst, total: taxable + gst, itcEligible });
      }
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (gstinStatus === 'invalid') { toast.error('Fix the supplier GSTIN'); return; }
    setLoading(true);
    try {
      const res = await purchasesAPI.create({
        ...form,
        vendorGstin: form.vendorGstin || undefined,
        items: items.map(i => ({
          description: i.description, hsnCode: i.hsnCode,
          quantity: parseFloat(i.quantity), unitPrice: parseFloat(i.unitPrice), gstRate: parseFloat(i.gstRate),
        })),
      });
      toast.success(`Purchase ${res.data.data.invoice.invoiceNumber} recorded!`);
      if (!res.data.data.itc.eligible) {
        toast(`ITC not available — no valid GSTIN`, { icon: '⚠️' });
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(extractErrors(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={S.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <button style={S.closeBtn} onClick={onClose}>✕</button>
        <h2 style={S.title}>Add Purchase Bill</h2>
        <p style={S.sub}>Record supplier invoice — ITC calculated automatically</p>

        <form onSubmit={handleSubmit}>
          <div style={S.row}>
            <Field label="Supplier Name *">
              <input style={S.input} value={form.vendorName} onChange={e => setForm(f => ({...f, vendorName: e.target.value}))} placeholder="Godrej Appliances Ltd" required />
            </Field>
            <Field label="Supplier State">
              <select style={S.input} value={form.vendorStateCode} onChange={e => setForm(f => ({...f, vendorStateCode: e.target.value}))}>
                {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
              </select>
            </Field>
          </div>
          <div style={S.row}>
            <Field label="Supplier GSTIN" hint="Required to claim ITC">
              <input
                style={{ ...S.input, fontFamily: 'monospace', textTransform: 'uppercase', borderColor: gstinStatus === 'invalid' ? '#A32D2D' : gstinStatus === 'valid' ? '#2D7D46' : undefined }}
                value={form.vendorGstin} onChange={e => handleGSTIN(e.target.value)} placeholder="27GODRE1234A1Z5" maxLength={15}
              />
              {gstinStatus === 'valid' && <span style={S.greenHint}>✓ Valid — ITC will be available</span>}
              {gstinStatus === 'invalid' && <span style={S.redHint}>⚠ Invalid GSTIN — ITC blocked</span>}
              {!form.vendorGstin && <span style={S.grayHint}>ITC blocked without GSTIN</span>}
            </Field>
            <Field label="Invoice Date *">
              <input style={S.input} type="date" value={form.invoiceDate} onChange={e => setForm(f => ({...f, invoiceDate: e.target.value}))} required />
            </Field>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <Field label="Supplier Invoice No / Reference">
              <input style={S.input} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} placeholder="e.g. GDJ/2025/1234" />
            </Field>
          </div>

          {/* Items */}
          <div style={{ marginBottom: '14px', fontSize: '11px', fontWeight: '600', color: '#9E9B93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Items</div>
          {items.map((item, idx) => (
            <div key={idx} style={{ border: '1px solid #E2DFD5', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
              <div style={S.row}>
                <Field label="Description *">
                  <input style={S.input} value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} placeholder="Product / item name" required />
                </Field>
                <Field label="HSN Code *">
                  <input style={{ ...S.input, fontFamily: 'monospace' }} value={item.hsnCode} onChange={e => handleItemChange(idx, 'hsnCode', e.target.value)} placeholder="8414" required />
                </Field>
              </div>
              <div style={S.row}>
                <Field label="Qty *" style={{ maxWidth: '90px' }}>
                  <input style={S.input} type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} required />
                </Field>
                <Field label="Unit Price ₹ *">
                  <input style={S.input} type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)} placeholder="0.00" required />
                </Field>
                <Field label="GST Rate %">
                  <select style={S.input} value={item.gstRate} onChange={e => handleItemChange(idx, 'gstRate', e.target.value)}>
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </Field>
              </div>
            </div>
          ))}
          <button type="button" style={S.addItem} onClick={() => setItems(p => [...p, { description: '', hsnCode: '', quantity: 1, unitPrice: '', gstRate: 18 }])}>+ Add item</button>

          {preview && (
            <div style={S.itcBox}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: preview.itcEligible ? '#0F6E56' : '#A32D2D', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                {preview.itcEligible ? '✓ ITC Available' : '✗ ITC Blocked'}
              </div>
              <div style={S.gstRow}><span style={{ color: '#6B6960' }}>Taxable Amount</span><span>{fmt(preview.taxable)}</span></div>
              <div style={S.gstRow}><span style={{ color: '#6B6960' }}>GST Amount</span><span>{fmt(preview.gst)}</span></div>
              <div style={{ ...S.gstRow, fontWeight: '700', borderTop: '1px solid #E2DFD5', paddingTop: '8px', marginTop: '4px' }}>
                <span>Total Bill</span><span>{fmt(preview.total)}</span>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button type="button" style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...S.saveBtn, opacity: loading ? .7 : 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Purchase'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Purchases List ─────────────────────────────────────────────
export function PurchasesList({ onAddPurchase }) {
  const { period } = usePeriod();
  const { data, loading } = usePurchases({ period });
  const purchases = data?.data || data || [];
  const itcTotal  = Array.isArray(purchases) ? purchases.filter(p => p.itcEligible).reduce((a,p) => a + p.itcCgst + p.itcSgst + p.itcIgst, 0) : 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' }}>Purchase Bills</div>
          <div style={{ fontSize: '13px', color: '#9E9B93', marginTop: '2px' }}>ITC available: {fmt(itcTotal)} • {periodLabel(period)}</div>
        </div>
        <button style={{ background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }} onClick={onAddPurchase}>+ Add Purchase</button>
      </div>

      {itcTotal > 0 && (
        <div style={{ background: '#EAF5EE', border: '1px solid #C0DD97', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '16px', fontSize: '13px', color: '#0F6E56' }}>
          <span>✓</span>
          <span>Input Tax Credit of <strong>{fmt(itcTotal)}</strong> is claimable this period.</span>
        </div>
      )}

      {loading ? <div style={{ background: '#F0EEE8', borderRadius: '12px', height: '200px' }} /> : (
        <div style={{ background: '#fff', border: '1px solid #E2DFD5', borderRadius: '14px', overflow: 'hidden' }}>
          {!Array.isArray(purchases) || purchases.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#9E9B93' }}>No purchases this period</p>
              <button style={{ background: 'none', border: 'none', color: '#2D7D46', cursor: 'pointer', fontWeight: '600', fontSize: '13px', fontFamily: 'inherit', marginTop: '8px' }} onClick={onAddPurchase}>Record your first bill</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {['Ref #', 'Date', 'Supplier', 'Taxable', 'GST Paid', 'Total', 'ITC'].map(h => (
                      <th key={h} style={{ background: '#F7F6F2', padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E2DFD5' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #F0EEE8' }}>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#185FA5' }}>{p.invoiceNumber}</td>
                      <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6B6960' }}>{fmtDate(p.invoiceDate)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '500' }}>{p.party?.name || 'Unknown'}</td>
                      <td style={{ padding: '10px 12px' }}>{fmt(p.taxableAmount)}</td>
                      <td style={{ padding: '10px 12px', color: '#6B6960' }}>{fmt(p.cgst + p.sgst + p.igst)}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '600' }}>{fmt(p.totalAmount)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: p.itcEligible ? '#EAF5EE' : '#FCEBEB', color: p.itcEligible ? '#2D7D46' : '#A32D2D', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>
                          {p.itcEligible ? 'Eligible' : 'Blocked'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children, style }) {
  return (
    <div style={{ flex: 1, minWidth: 0, ...style }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: '10px', color: '#9E9B93' }}>{hint}</span>}
    </div>
  );
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modal: { background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' },
  closeBtn: { position: 'absolute', top: '16px', right: '16px', background: '#F7F6F2', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px' },
  title: { fontSize: '18px', fontWeight: '600', marginBottom: '4px' },
  sub: { fontSize: '12px', color: '#9E9B93', marginBottom: '22px' },
  row: { display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #E2DFD5', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  greenHint: { display: 'block', fontSize: '11px', color: '#2D7D46', marginTop: '3px', fontWeight: '600' },
  redHint:   { display: 'block', fontSize: '11px', color: '#A32D2D', marginTop: '3px' },
  grayHint:  { display: 'block', fontSize: '11px', color: '#9E9B93', marginTop: '3px' },
  addItem: { background: 'none', border: '1px dashed #E2DFD5', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', color: '#6B6960', width: '100%', fontFamily: 'inherit', marginBottom: '14px' },
  itcBox: { background: '#F7F6F2', border: '1px solid #E2DFD5', borderRadius: '10px', padding: '14px' },
  gstRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' },
  cancelBtn: { padding: '9px 18px', background: 'transparent', border: '1px solid #E2DFD5', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#6B6960' },
  saveBtn: { padding: '9px 20px', background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
};
