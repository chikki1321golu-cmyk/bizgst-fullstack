/**
 * Products Page — manage product catalog with HSN codes
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { productsAPI } from '../../services/api';
import { useProducts } from '../../hooks/useData';
import { fmt, GST_RATES, extractErrors } from '../../utils/helpers';

export default function ProductsPage() {
  const { data: products = [], refetch } = useProducts();
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', hsnCode: '', gstRate: 18, unit: 'Nos', basePrice: '' });

  async function handleAdd(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await productsAPI.create(form);
      toast.success('Product added to catalog');
      setShowAdd(false);
      setForm({ name: '', hsnCode: '', gstRate: 18, unit: 'Nos', basePrice: '' });
      refetch();
    } catch (err) {
      toast.error(extractErrors(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Deactivate this product?')) return;
    try {
      await productsAPI.remove(id);
      toast.success('Product deactivated');
      refetch();
    } catch (err) {
      toast.error(extractErrors(err));
    }
  }

  const rateColor = (r) => {
    if (r === 0)  return ['#F0EEE8', '#6B6960'];
    if (r <= 5)   return ['#EAF5EE', '#2D7D46'];
    if (r <= 12)  return ['#E6F1FB', '#185FA5'];
    if (r <= 18)  return ['#FAEEDA', '#BA7517'];
    return              ['#FCEBEB', '#A32D2D'];
  };

  return (
    <div>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Product Catalog</div>
          <div style={S.sub}>HSN codes and GST rates auto-apply on every sale — no manual entry needed</div>
        </div>
        <button style={S.addBtn} onClick={() => setShowAdd(true)}>+ Add Product</button>
      </div>

      <div style={S.infoBar}>
        💡 Products you add here will appear in the "Add Sale" dropdown. GST rate auto-fills based on the product.
      </div>

      {showAdd && (
        <div style={S.formCard}>
          <div style={{ fontWeight: '600', marginBottom: '14px', fontSize: '14px' }}>New Product</div>
          <form onSubmit={handleAdd}>
            <div style={S.formRow}>
              <Field label="Product Name *">
                <input style={S.input} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="e.g. Ceiling Fan" required />
              </Field>
              <Field label="HSN / SAC Code *" hint="4-8 digit code from GST rate schedule">
                <input style={{ ...S.input, fontFamily: 'monospace' }} value={form.hsnCode} onChange={e => setForm(f => ({...f, hsnCode: e.target.value}))} placeholder="8414" required />
              </Field>
            </div>
            <div style={S.formRow}>
              <Field label="GST Rate *">
                <select style={S.input} value={form.gstRate} onChange={e => setForm(f => ({...f, gstRate: parseFloat(e.target.value)}))}>
                  {GST_RATES.map(r => <option key={r} value={r}>{r}% {r === 0 ? '(Exempt)' : ''}</option>)}
                </select>
              </Field>
              <Field label="Unit">
                <select style={S.input} value={form.unit} onChange={e => setForm(f => ({...f, unit: e.target.value}))}>
                  {['Nos', 'Kg', 'Ltr', 'Mtr', 'Box', 'Pcs', 'Strip', 'Set'].map(u => <option key={u}>{u}</option>)}
                </select>
              </Field>
              <Field label="Default Price ₹">
                <input style={S.input} type="number" min="0" step="0.01" value={form.basePrice} onChange={e => setForm(f => ({...f, basePrice: e.target.value}))} placeholder="0.00" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" style={{ ...S.saveBtn, opacity: loading ? .7 : 1 }} disabled={loading}>
                {loading ? 'Saving...' : 'Add Product'}
              </button>
              <button type="button" style={S.cancelBtn} onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div style={S.tableCard}>
        <table style={S.table}>
          <thead>
            <tr>
              {['Product Name', 'HSN Code', 'GST Rate', 'Unit', 'Default Price', 'Tax/Unit', ''].map(h => (
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(products) ? products : []).map(p => {
              const [bg, col] = rateColor(p.gstRate);
              return (
                <tr key={p.id} style={S.tr}>
                  <td style={{ ...S.td, fontWeight: '500' }}>{p.name}</td>
                  <td style={S.td}><span style={S.hsnBadge}>{p.hsnCode}</span></td>
                  <td style={S.td}><span style={{ background: bg, color: col, fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px' }}>{p.gstRate}%</span></td>
                  <td style={{ ...S.td, color: '#6B6960' }}>{p.unit}</td>
                  <td style={S.td}>{p.basePrice ? fmt(p.basePrice) : '—'}</td>
                  <td style={{ ...S.td, color: '#BA7517' }}>{p.basePrice ? fmt(p.basePrice * p.gstRate / 100) : '—'}</td>
                  <td style={S.td}>
                    <button style={S.delBtn} onClick={() => handleDelete(p.id)}>Remove</button>
                  </td>
                </tr>
              );
            })}
            {(!Array.isArray(products) || products.length === 0) && (
              <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9E9B93', fontSize: '13px' }}>
                No products yet — add your first product above
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>{label}</label>
      {children}
      {hint && <span style={{ fontSize: '10px', color: '#9E9B93', display: 'block', marginTop: '3px' }}>{hint}</span>}
    </div>
  );
}

const S = {
  hdr: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' },
  sub: { fontSize: '13px', color: '#9E9B93', marginTop: '2px' },
  addBtn: { background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
  infoBar: { background: '#1A1A18', color: '#C0DD97', fontSize: '12px', padding: '10px 16px', borderRadius: '10px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' },
  formCard: { background: '#fff', border: '1px solid #E2DFD5', borderRadius: '12px', padding: '18px', marginBottom: '16px' },
  formRow: { display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' },
  input: { width: '100%', padding: '9px 12px', border: '1px solid #E2DFD5', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  saveBtn: { background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
  cancelBtn: { background: 'transparent', border: '1px solid #E2DFD5', borderRadius: '8px', padding: '9px 16px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', color: '#6B6960' },
  tableCard: { background: '#fff', border: '1px solid #E2DFD5', borderRadius: '14px', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { background: '#F7F6F2', padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E2DFD5' },
  tr: { borderBottom: '1px solid #F0EEE8' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  hsnBadge: { fontFamily: 'monospace', fontSize: '11px', background: '#F0EEE8', padding: '2px 8px', borderRadius: '4px', color: '#6B6960' },
  delBtn: { background: '#FCEBEB', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', color: '#A32D2D', fontFamily: 'inherit' },
};
