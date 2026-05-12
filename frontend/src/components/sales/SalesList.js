/**
 * Sales List + Invoice View Modal
 */
import React, { useState } from 'react';
import { useSales, usePeriod } from '../../hooks/useData';
import { salesAPI } from '../../services/api';
import { fmt, fmtDate, periodLabel } from '../../utils/helpers';

export function SalesList({ onAddSale }) {
  const { period, setPeriod } = usePeriod();
  const { data, loading, refetch } = useSales({ period });
  const invoices = data?.data || data || [];
  const [viewInvoice, setViewInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  async function handleView(id) {
    setInvoiceLoading(true);
    try {
      const res = await salesAPI.get(id);
      setViewInvoice(res.data.data);
    } catch (err) {
      alert('Could not load invoice. Please try again.');
    } finally {
      setInvoiceLoading(false);
    }
  }

  return (
    <div>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Sales Invoices</div>
          <div style={S.sub}>
            {Array.isArray(invoices) ? invoices.length : 0} invoices • {periodLabel(period)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select style={S.periodSel} value={period} onChange={e => setPeriod(e.target.value)}>
            {recentPeriods().map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <button style={S.addBtn} onClick={onAddSale}>+ Add Sale</button>
        </div>
      </div>

      {loading ? (
        <div style={S.skeleton} />
      ) : (
        <div style={S.card}>
          {!Array.isArray(invoices) || invoices.length === 0 ? (
            <div style={S.empty}>
              <p style={{ color: '#9E9B93' }}>No sales this period</p>
              <button style={S.emptyBtn} onClick={onAddSale}>
                Add your first sale
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Invoice #','Date','Customer','Taxable','GST','Total','Type',''].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} style={S.tr}>
                      <td style={{ ...S.td, fontFamily:'monospace', fontSize:'11px', color:'#185FA5' }}>
                        {inv.invoiceNumber}
                      </td>
                      <td style={{ ...S.td, fontSize:'12px', color:'#6B6960' }}>
                        {fmtDate(inv.invoiceDate)}
                      </td>
                      <td style={{ ...S.td, fontWeight:'500', maxWidth:'140px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {inv.party?.name || 'Walk-in'}
                      </td>
                      <td style={S.td}>{fmt(inv.taxableAmount)}</td>
                      <td style={{ ...S.td, color:'#BA7517' }}>
                        {fmt(inv.cgst + inv.sgst + inv.igst)}
                      </td>
                      <td style={{ ...S.td, fontWeight:'600' }}>{fmt(inv.totalAmount)}</td>
                      <td style={S.td}><SupplyBadge type={inv.supplyType} /></td>
                      <td style={S.td}>
                        <button
                          style={S.viewBtn}
                          onClick={() => handleView(inv.id)}
                          disabled={invoiceLoading}
                        >
                          {invoiceLoading ? '...' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Metrics */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginTop:'16px' }}>
        <SmallMetric label="Total Sales"    value={fmt(Array.isArray(invoices) ? invoices.reduce((a,s)=>a+s.totalAmount,0) : 0)}   color="#2D7D46" />
        <SmallMetric label="GST Collected"  value={fmt(Array.isArray(invoices) ? invoices.reduce((a,s)=>a+s.cgst+s.sgst+s.igst,0) : 0)} color="#BA7517" />
        <SmallMetric label="B2B Sales"      value={fmt(Array.isArray(invoices) ? invoices.filter(s=>s.supplyType==='B2B').reduce((a,s)=>a+s.totalAmount,0) : 0)} color="#185FA5" />
      </div>

      {/* Invoice Modal */}
      {viewInvoice && (
        <InvoiceModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} />
      )}
    </div>
  );
}

// ── Invoice Modal ─────────────────────────────────────────────
function InvoiceModal({ invoice, onClose }) {
  const inv = invoice;
  const isInter = inv.isInterstate;
  const business = inv.business || {};
  const gstTotal = inv.cgst + inv.sgst + inv.igst;

  function printInvoice() {
    window.print();
  }

  function shareWhatsApp() {
    const text = `Invoice ${inv.invoiceNumber}\nAmount: ${fmt(inv.totalAmount)}\nGST: ${fmt(gstTotal)}\nDate: ${fmtDate(inv.invoiceDate)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
  }

  return (
    <div style={M.backdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={M.modal} id="invoice-print-area">

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'12px' }}>
          <div>
            <div style={{ fontSize:'20px', fontWeight:'700', color:'#2D7D46' }}>
              Biz<span style={{ color:'#1A1A18' }}>GST</span>
            </div>
            <div style={{ marginTop:'8px', fontSize:'13px', fontWeight:'600' }}>
              {business.name || 'Your Business'}
            </div>
            <div style={{ fontSize:'12px', color:'#6B6960', marginTop:'2px' }}>
              {business.address || ''}
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'11px', color:'#6B6960', marginTop:'2px' }}>
              GSTIN: {business.gstin || ''}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'11px', color:'#9E9B93', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              Tax Invoice
            </div>
            <div style={{ fontFamily:'monospace', fontSize:'16px', fontWeight:'700', color:'#185FA5', marginTop:'4px' }}>
              {inv.invoiceNumber}
            </div>
            <div style={{ fontSize:'12px', color:'#6B6960', marginTop:'4px' }}>
              {fmtDate(inv.invoiceDate)}
            </div>
            <div style={{ marginTop:'6px' }}>
              <SupplyBadge type={inv.supplyType} />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height:'1px', background:'#E2DFD5', marginBottom:'16px' }} />

        {/* Bill To */}
        <div style={{ background:'#F7F6F2', borderRadius:'8px', padding:'12px 14px', marginBottom:'16px' }}>
          <div style={{ fontSize:'10px', color:'#9E9B93', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>
            Bill To
          </div>
          <div style={{ fontWeight:'600', fontSize:'14px' }}>
            {inv.party?.name || 'Walk-in Customer'}
          </div>
          {inv.party?.gstin && (
            <div style={{ fontFamily:'monospace', fontSize:'11px', color:'#185FA5', marginTop:'2px' }}>
              GSTIN: {inv.party.gstin}
            </div>
          )}
          {inv.party?.stateCode && (
            <div style={{ fontSize:'12px', color:'#6B6960', marginTop:'2px' }}>
              State: {inv.party.stateName || inv.party.stateCode}
            </div>
          )}
        </div>

        {/* Items Table */}
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', marginBottom:'16px' }}>
          <thead>
            <tr style={{ background:'#F7F6F2' }}>
              {['#','Item','HSN','Qty','Rate','GST%','Amount'].map(h => (
                <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:'10px', fontWeight:'600', color:'#6B6960', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid #E2DFD5' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(inv.items || []).map((item, idx) => (
              <tr key={item.id || idx} style={{ borderBottom:'1px solid #F0EEE8' }}>
                <td style={{ padding:'10px', color:'#9E9B93' }}>{idx + 1}</td>
                <td style={{ padding:'10px', fontWeight:'500' }}>{item.description}</td>
                <td style={{ padding:'10px', fontFamily:'monospace', fontSize:'11px', background:'#F7F6F2', borderRadius:'4px' }}>
                  {item.hsnCode}
                </td>
                <td style={{ padding:'10px' }}>{item.quantity} {item.unit}</td>
                <td style={{ padding:'10px' }}>{fmt(item.unitPrice)}</td>
                <td style={{ padding:'10px' }}>{item.gstRate}%</td>
                <td style={{ padding:'10px', fontWeight:'600' }}>{fmt(item.taxableAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Tax Summary */}
        <div style={{ marginLeft:'auto', maxWidth:'280px', marginBottom:'20px' }}>
          <TaxRow label="Taxable Amount" value={fmt(inv.taxableAmount)} />
          {isInter ? (
            <TaxRow label={`IGST @ ${(inv.items?.[0]?.gstRate || 0)}%`} value={fmt(inv.igst)} />
          ) : (
            <>
              <TaxRow label={`CGST @ ${(inv.items?.[0]?.gstRate || 0) / 2}%`} value={fmt(inv.cgst)} />
              <TaxRow label={`SGST @ ${(inv.items?.[0]?.gstRate || 0) / 2}%`} value={fmt(inv.sgst)} />
            </>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', fontSize:'16px', fontWeight:'700', borderTop:'2px solid #1A1A18', marginTop:'4px' }}>
            <span>Total</span>
            <span>{fmt(inv.totalAmount)}</span>
          </div>
        </div>

        {/* Supply Info */}
        <div style={{ fontSize:'11px', color:'#9E9B93', textAlign:'center', padding:'12px', background:'#F7F6F2', borderRadius:'8px', marginBottom:'16px' }}>
          {isInter ? '🔄 Interstate Supply — IGST Applied' : '📍 Intrastate Supply — CGST + SGST Applied'}
          {' '}• {inv.isRcm ? 'Reverse Charge: Yes' : 'Reverse Charge: No'}
          <br />
          This is a computer-generated invoice
        </div>

        {/* Action Buttons */}
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button style={M.closeBtn} onClick={onClose}>Close</button>
          <button style={M.whatsappBtn} onClick={shareWhatsApp}>
            📱 Share on WhatsApp
          </button>
          <button style={M.printBtn} onClick={printInvoice}>
            🖨 Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────

function TaxRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', fontSize:'13px', borderBottom:'1px solid #F0EEE8' }}>
      <span style={{ color:'#6B6960' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function SupplyBadge({ type }) {
  const map = {
    B2B:  ['#E6F1FB','#185FA5'],
    B2CS: ['#EAF5EE','#2D7D46'],
    B2C:  ['#F0EEE8','#6B6960'],
  };
  const [bg, col] = map[type] || map.B2C;
  return (
    <span style={{ background:bg, color:col, fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'20px' }}>
      {type}
    </span>
  );
}

function SmallMetric({ label, value, color }) {
  return (
    <div style={{ background:'#fff', border:'1px solid #E2DFD5', borderRadius:'12px', padding:'14px', borderTop:`3px solid ${color}` }}>
      <div style={{ fontSize:'11px', color:'#9E9B93', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>
        {label}
      </div>
      <div style={{ fontSize:'20px', fontWeight:'600' }}>{value}</div>
    </div>
  );
}

function recentPeriods() {
  const periods = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const y = d.getFullYear();
    periods.push({
      value: `${m}${y}`,
      label: d.toLocaleDateString('en-IN', { month:'long', year:'numeric' }),
    });
  }
  return periods;
}

// ── Styles ────────────────────────────────────────────────────
const S = {
  hdr:       { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' },
  title:     { fontSize:'20px', fontWeight:'600', letterSpacing:'-0.3px' },
  sub:       { fontSize:'13px', color:'#9E9B93', marginTop:'2px' },
  periodSel: { padding:'7px 12px', border:'1px solid #E2DFD5', borderRadius:'8px', fontSize:'13px', fontFamily:'inherit', background:'#fff', cursor:'pointer' },
  addBtn:    { background:'#2D7D46', color:'#fff', border:'none', borderRadius:'8px', padding:'8px 16px', cursor:'pointer', fontSize:'13px', fontWeight:'600', fontFamily:'inherit' },
  card:      { background:'#fff', border:'1px solid #E2DFD5', borderRadius:'14px', overflow:'hidden' },
  skeleton:  { background:'#F0EEE8', borderRadius:'12px', height:'200px' },
  table:     { width:'100%', borderCollapse:'collapse', fontSize:'13px' },
  th:        { background:'#F7F6F2', padding:'10px 12px', textAlign:'left', fontSize:'10px', fontWeight:'600', color:'#6B6960', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid #E2DFD5' },
  tr:        { borderBottom:'1px solid #F0EEE8' },
  td:        { padding:'10px 12px', verticalAlign:'middle' },
  viewBtn:   { background:'#F7F6F2', border:'none', borderRadius:'6px', padding:'5px 12px', cursor:'pointer', fontSize:'12px', color:'#6B6960', fontFamily:'inherit', fontWeight:'500' },
  empty:     { padding:'40px', textAlign:'center' },
  emptyBtn:  { background:'none', border:'none', color:'#2D7D46', cursor:'pointer', fontSize:'13px', fontWeight:'600', marginTop:'8px', fontFamily:'inherit' },
};

const M = {
  backdrop:    { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' },
  modal:       { background:'#fff', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'620px', maxHeight:'90vh', overflowY:'auto' },
  closeBtn:    { padding:'9px 16px', background:'transparent', border:'1px solid #E2DFD5', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontFamily:'inherit', color:'#6B6960' },
  printBtn:    { padding:'9px 16px', background:'#E6F1FB', color:'#185FA5', border:'1px solid #B5D4F4', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'600', fontFamily:'inherit' },
  whatsappBtn: { padding:'9px 16px', background:'#EAF5EE', color:'#2D7D46', border:'1px solid #C0DD97', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'600', fontFamily:'inherit' },
};
