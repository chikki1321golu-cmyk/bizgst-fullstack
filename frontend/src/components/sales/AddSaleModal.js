/**
 * Add Sale Modal
 * Sends to POST /api/sales — backend calculates all GST
 */
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { salesAPI } from '../../services/api';
import { useProducts, useParties } from '../../hooks/useData';
import { validateGSTIN, INDIAN_STATES, todayISO, fmt, extractErrors } from '../../utils/helpers';
import { useAuth } from '../../context/AuthContext';

export default function AddSaleModal({ onClose, onSuccess }) {
  const { business } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useParties('CUSTOMER');

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    partyName:    '',
    partyGstin:   '',
    partyStateCode: business?.stateCode || '27',
    invoiceDate:  todayISO(),
    notes:        '',
  });
  const [items, setItems] = useState([{ productId: '', description: '', hsnCode: '', quantity: 1, unitPrice: '', gstRate: 18, discount: 0 }]);
  const [preview, setPreview] = useState(null);
  const [gstinStatus, setGstinStatus] = useState('');

  // Live preview: compute local estimate (final comes from server)
  useEffect(() => {
    const item = items[0];
    if (!item.quantity || !item.unitPrice || !item.gstRate && item.gstRate !== 0) { setPreview(null); return; }
    const taxable = parseFloat(item.quantity) * parseFloat(item.unitPrice) - parseFloat(item.discount || 0);
    if (taxable <= 0) { setPreview(null); return; }
    const gst = taxable * parseFloat(item.gstRate) / 100;
    const isInter = form.partyStateCode !== (business?.stateCode || '27');
    const cgst = isInter ? 0 : gst / 2;
    const sgst = isInter ? 0 : gst / 2;
    const igst = isInter ? gst : 0;
    const isB2B = validateGSTIN(form.partyGstin);
    setPreview({ taxable, cgst, sgst, igst, total: taxable + gst, isInter, isB2B, rate: item.gstRate });
  }, [items, form.partyStateCode, form.partyGstin, business]);

  function handleGSTIN(v) {
    const val = v.toUpperCase();
    setForm(f => ({ ...f, partyGstin: val }));
    if (!val) setGstinStatus('');
    else if (val.length === 15 && validateGSTIN(val)) setGstinStatus('valid');
    else setGstinStatus('invalid');
  }

  function handleItemChange(idx, field, value) {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      // Auto-fill from product
      if (field === 'productId' && value) {
        const prod = products.find(p => p.id === value);
        if (prod) {
          next[idx].hsnCode    = prod.hsnCode;
          next[idx].gstRate    = prod.gstRate;
          next[idx].unitPrice  = prod.basePrice || '';
          next[idx].description = prod.name;
        }
      }
      return next;
    });
  }

  function addItem() {
    setItems(prev => [...prev, { productId: '', description: '', hsnCode: '', quantity: 1, unitPrice: '', gstRate: 18, discount: 0 }]);
  }

  function removeItem(idx) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (gstinStatus === 'invalid') { toast.error('Fix the GSTIN before submitting'); return; }
    if (items.some(i => !i.quantity || !i.unitPrice)) { toast.error('Fill quantity and price for all items'); return; }

    setLoading(true);
    try {
      const payload = {
        ...form,
        partyGstin:    form.partyGstin || undefined,
        partyStateCode: form.partyStateCode,
        items: items.map(i => ({
          productId:   i.productId || undefined,
          description: i.description,
          hsnCode:     i.hsnCode,
          quantity:    parseFloat(i.quantity),
          unitPrice:   parseFloat(i.unitPrice),
          gstRate:     parseFloat(i.gstRate),
          discount:    parseFloat(i.discount || 0),
        })),
      };
      const res = await salesAPI.create(payload);
      toast.success(`Invoice ${res.data.data.invoice.invoiceNumber} created!`);
      onSuccess?.(res.data.data.invoice);
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
        <h2 style={S.title}>Add New Sale</h2>
        <p style={S.sub}>GST is calculated automatically — just fill in the details</p>

        <form onSubmit={handleSubmit}>
          {/* Customer Section */}
          <Section label="Customer Details">
            <div style={S.row}>
              <Field label="Customer Name *">
                <input style={S.input} value={form.partyName} onChange={e => setForm(f => ({...f, partyName: e.target.value}))} placeholder="Ramesh Traders / Walk-in Customer" required />
              </Field>
              <Field label="Customer State">
                <select style={S.input} value={form.partyStateCode} onChange={e => setForm(f => ({...f, partyStateCode: e.target.value}))}>
                  {INDIAN_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <div style={S.row}>
              <Field label="Customer GSTIN (optional — B2B only)" hint="Leave blank for retail/walk-in customers">
                <input
                  style={{ ...S.input, fontFamily: 'monospace', letterSpacing: '0.04em', textTransform: 'uppercase', borderColor: gstinStatus === 'invalid' ? '#A32D2D' : gstinStatus === 'valid' ? '#2D7D46' : undefined }}
                  value={form.partyGstin} onChange={e => handleGSTIN(e.target.value)}
                  placeholder="27ABCDE1234F1Z5" maxLength={15}
                />
                {gstinStatus === 'valid' && <span style={S.successHint}>✓ Valid GSTIN — B2B invoice</span>}
                {gstinStatus === 'invalid' && <span style={S.errorHint}>⚠ Invalid GSTIN format</span>}
              </Field>
              <Field label="Invoice Date *">
                <input style={S.input} type="date" value={form.invoiceDate} onChange={e => setForm(f => ({...f, invoiceDate: e.target.value}))} required />
              </Field>
            </div>
          </Section>

          {/* Items */}
          <Section label="Items">
            {items.map((item, idx) => (
              <div key={idx} style={{ border: '1px solid #E2DFD5', borderRadius: '10px', padding: '14px', marginBottom: '10px', position: 'relative' }}>
                {items.length > 1 && (
                  <button type="button" style={S.removeItemBtn} onClick={() => removeItem(idx)}>✕</button>
                )}
                <div style={S.row}>
                  <Field label="Product">
                    <select style={S.input} value={item.productId} onChange={e => handleItemChange(idx, 'productId', e.target.value)}>
                      <option value="">-- Select or type below --</option>
                      {(products || []).map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.gstRate}%)</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="HSN Code *">
                    <input style={{ ...S.input, fontFamily: 'monospace' }} value={item.hsnCode} onChange={e => handleItemChange(idx, 'hsnCode', e.target.value)} placeholder="8517" required />
                  </Field>
                </div>
                <div style={S.row}>
                  <Field label="Description">
                    <input style={S.input} value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)} placeholder="Item name / description" />
                  </Field>
                  <Field label="GST Rate %">
                    <select style={S.input} value={item.gstRate} onChange={e => handleItemChange(idx, 'gstRate', e.target.value)}>
                      {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  </Field>
                </div>
                <div style={S.row}>
                  <Field label="Quantity *" style={{ maxWidth: '100px' }}>
                    <input style={S.input} type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)} required />
                  </Field>
                  <Field label="Unit Price ₹ *">
                    <input style={S.input} type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={e => handleItemChange(idx, 'unitPrice', e.target.value)} placeholder="0.00" required />
                  </Field>
                  <Field label="Discount ₹">
                    <input style={S.input} type="number" min="0" step="0.01" value={item.discount} onChange={e => handleItemChange(idx, 'discount', e.target.value)} placeholder="0" />
                  </Field>
                </div>
              </div>
            ))}
            <button type="button" style={S.addItemBtn} onClick={addItem}>+ Add another item</button>
          </Section>

          {/* GST Preview */}
          {preview && (
            <div style={S.gstBox}>
              <div style={S.gstTitle}>GST Preview (auto-calculated)</div>
              <div style={S.gstRow}><span style={S.gstLabel}>Taxable Amount</span><span>{fmt(preview.taxable)}</span></div>
              {preview.isInter ? (
                <div style={S.gstRow}><span style={S.gstLabel}>IGST @ {preview.rate}%</span><span>{fmt(preview.igst)}</span></div>
              ) : (
                <>
                  <div style={S.gstRow}><span style={S.gstLabel}>CGST @ {preview.rate/2}%</span><span>{fmt(preview.cgst)}</span></div>
                  <div style={S.gstRow}><span style={S.gstLabel}>SGST @ {preview.rate/2}%</span><span>{fmt(preview.sgst)}</span></div>
                </>
              )}
              <div style={{ ...S.gstRow, borderTop: '1px solid #C0DD97', marginTop: '6px', paddingTop: '8px', fontWeight: '700', fontSize: '15px' }}>
                <span style={{ color: '#0F6E56' }}>Total Invoice</span>
                <span>{fmt(preview.total)}</span>
              </div>
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <Tag color="#E6F1FB" textColor="#185FA5">{preview.isB2B ? 'B2B' : 'B2C'}</Tag>
                <Tag color={preview.isInter ? '#FAEEDA' : '#EAF5EE'} textColor={preview.isInter ? '#854F0B' : '#0F6E56'}>
                  {preview.isInter ? 'Interstate → IGST' : 'Intrastate → CGST+SGST'}
                </Tag>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button type="button" style={S.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...S.submitBtn, opacity: loading ? .7 : 1 }} disabled={loading}>
              {loading ? 'Saving...' : 'Save & Generate Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#9E9B93', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{label}</div>
      {children}
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

function Tag({ color, textColor, children }) {
  return <span style={{ background: color, color: textColor, fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '20px' }}>{children}</span>;
}

const S = {
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  modal: { background: '#fff', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' },
  closeBtn: { position: 'absolute', top: '16px', right: '16px', background: '#F7F6F2', border: 'none', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: '18px', fontWeight: '600', marginBottom: '4px' },
  sub: { fontSize: '12px', color: '#9E9B93', marginBottom: '22px' },
  row: { display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #E2DFD5', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  successHint: { display: 'block', fontSize: '11px', color: '#2D7D46', marginTop: '3px', fontWeight: '600' },
  errorHint: { display: 'block', fontSize: '11px', color: '#A32D2D', marginTop: '3px' },
  gstBox: { background: '#EAF5EE', border: '1px solid #C0DD97', borderRadius: '10px', padding: '14px', marginTop: '4px' },
  gstTitle: { fontSize: '11px', fontWeight: '600', color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' },
  gstRow: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' },
  gstLabel: { color: '#6B6960' },
  addItemBtn: { background: 'none', border: '1px dashed #E2DFD5', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '12px', color: '#6B6960', width: '100%', fontFamily: 'inherit' },
  removeItemBtn: { position: 'absolute', top: '10px', right: '10px', background: '#FCEBEB', border: 'none', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '11px', color: '#A32D2D' },
  cancelBtn: { padding: '9px 18px', background: 'transparent', border: '1px solid #E2DFD5', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#6B6960' },
  submitBtn: { padding: '9px 20px', background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
};
