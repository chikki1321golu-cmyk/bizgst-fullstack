// SalesList.js
import React, { useState } from 'react';
import { useSales, usePeriod } from '../../hooks/useData';
import { fmt, fmtDate, periodLabel } from '../../utils/helpers';

export function SalesList({ onAddSale }) {
  const { period, setPeriod } = usePeriod();
  const { data, loading } = useSales({ period });
  const invoices = data?.data || data || [];

  return (
    <div>
      <div style={S.hdr}>
        <div>
          <div style={S.title}>Sales Invoices</div>
          <div style={S.sub}>{Array.isArray(invoices) ? invoices.length : 0} invoices • {periodLabel(period)}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select style={S.periodSel} value={period} onChange={e => setPeriod(e.target.value)}>
            {recentPeriods().map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <button style={S.addBtn} onClick={onAddSale}>+ Add Sale</button>
        </div>
      </div>

      {loading ? <Skeleton /> : (
        <div style={S.card}>
          {!Array.isArray(invoices) || invoices.length === 0 ? (
            <div style={S.empty}>
              <p style={{ color: '#9E9B93' }}>No sales this period</p>
              <button style={S.emptyBtn} onClick={onAddSale}>Add your first sale</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    {['Invoice #', 'Date', 'Customer', 'Taxable', 'GST', 'Total', 'Type', ''].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => (
                    <tr key={inv.id} style={S.tr}>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '11px', color: '#185FA5' }}>{inv.invoiceNumber}</td>
                      <td style={{ ...S.td, fontSize: '12px', color: '#6B6960' }}>{fmtDate(inv.invoiceDate)}</td>
                      <td style={{ ...S.td, fontWeight: '500', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.party?.name || 'Walk-in'}</td>
                      <td style={S.td}>{fmt(inv.taxableAmount)}</td>
                      <td style={{ ...S.td, color: '#BA7517' }}>{fmt(inv.cgst + inv.sgst + inv.igst)}</td>
                      <td style={{ ...S.td, fontWeight: '600' }}>{fmt(inv.totalAmount)}</td>
                      <td style={S.td}><SupplyBadge type={inv.supplyType} /></td>
                      <td style={S.td}><button style={S.viewBtn} onClick={() => alert(`Invoice: ${inv.invoiceNumber}`)}>View</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '16px' }}>
        <SmallMetric label="Total Sales" value={fmt(invoices.reduce ? invoices.reduce((a, s) => a + s.totalAmount, 0) : 0)} color="#2D7D46" />
        <SmallMetric label="GST Collected" value={fmt(invoices.reduce ? invoices.reduce((a, s) => a + s.cgst + s.sgst + s.igst, 0) : 0)} color="#BA7517" />
        <SmallMetric label="B2B Sales" value={fmt(invoices.filter ? invoices.filter(s => s.supplyType === 'B2B').reduce((a, s) => a + s.totalAmount, 0) : 0)} color="#185FA5" />
      </div>
    </div>
  );
}

function SupplyBadge({ type }) {
  const map = { B2B: ['#E6F1FB', '#185FA5'], B2CS: ['#EAF5EE', '#2D7D46'], B2C: ['#F0EEE8', '#6B6960'] };
  const [bg, col] = map[type] || map.B2C;
  return <span style={{ background: bg, color: col, fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>{type}</span>;
}

function SmallMetric({ label, value, color }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E2DFD5', borderRadius: '12px', padding: '14px', borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: '11px', color: '#9E9B93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: '600' }}>{value}</div>
    </div>
  );
}

function Skeleton() {
  return <div style={{ background: '#F0EEE8', borderRadius: '12px', height: '200px' }} />;
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
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    });
  }
  return periods;
}

const S = {
  hdr: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' },
  sub: { fontSize: '13px', color: '#9E9B93', marginTop: '2px' },
  periodSel: { padding: '7px 12px', border: '1px solid #E2DFD5', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', background: '#fff', cursor: 'pointer' },
  addBtn: { background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
  card: { background: '#fff', border: '1px solid #E2DFD5', borderRadius: '14px', padding: '0', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { background: '#F7F6F2', padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E2DFD5' },
  tr: { borderBottom: '1px solid #F0EEE8' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  viewBtn: { background: '#F7F6F2', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: '#6B6960', fontFamily: 'inherit' },
  empty: { padding: '40px', textAlign: 'center' },
  emptyBtn: { background: 'none', border: 'none', color: '#2D7D46', cursor: 'pointer', fontSize: '13px', fontWeight: '600', marginTop: '8px', fontFamily: 'inherit' },
};
