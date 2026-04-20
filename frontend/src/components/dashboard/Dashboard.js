/**
 * Dashboard — Real-time GST summary from backend
 */
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useGSTSummary, useSales, usePurchases, usePeriod } from '../../hooks/useData';
import { fmt, fmtDate, periodLabel } from '../../utils/helpers';

export default function Dashboard({ onNavigate, onAddSale, onAddPurchase }) {
  const { business } = useAuth();
  const { period } = usePeriod();
  const { data: summary, loading: sumLoading } = useGSTSummary(period);
  const { data: salesData } = useSales({ period, limit: 5 });
  const { data: purchasesData } = usePurchases({ period, limit: 3 });

  const sales     = salesData?.data || salesData || [];
  const purchases = purchasesData?.data || purchasesData || [];

  const recentSales = Array.isArray(sales) ? sales.slice(0, 5) : [];

  return (
    <div>
      <div style={S.header}>
        <div>
          <div style={S.title}>Dashboard</div>
          <div style={S.sub}>{periodLabel(period)} • {business?.name}</div>
        </div>
        <span style={S.periodBadge}>{periodLabel(period)}</span>
      </div>

      {/* GST Due Alert */}
      <div style={S.alert}>
        <span style={{ fontSize: '16px' }}>⚠</span>
        <div>
          <strong>GSTR-3B due on 20th of next month.</strong>
          {' '}<span style={{ cursor: 'pointer', textDecoration: 'underline', color: '#854F0B' }}
            onClick={() => onNavigate('gst')}>Generate return now →</span>
        </div>
      </div>

      {/* Metric Cards */}
      {sumLoading ? (
        <div style={S.loadingGrid}>
          {[1,2,3,4].map(i => <div key={i} style={S.skeletonCard} />)}
        </div>
      ) : (
        <div style={S.metrics}>
          <MetricCard label="Total Sales" value={fmt(summary?.totalSales)} sub={`${summary?.salesCount || 0} invoices`} color="#2D7D46" />
          <MetricCard label="Total Purchases" value={fmt(summary?.totalPurchases)} sub={`${summary?.purchasesCount || 0} bills`} color="#185FA5" />
          <MetricCard label="GST Collected" value={fmt(summary?.outputGST)} sub="Output tax" color="#BA7517" />
          <MetricCard label="Net GST Payable" value={fmt(summary?.netPayable)} sub={`ITC: ${fmt(summary?.itcAvailable)}`} color="#A32D2D" />
        </div>
      )}

      {/* Quick Actions */}
      <div style={S.actions}>
        <ActionBtn icon="➕" label="Add Sale" sub="Record invoice" onClick={onAddSale} color="#EAF5EE" />
        <ActionBtn icon="📥" label="Add Purchase" sub="Record bill" onClick={onAddPurchase} color="#E6F1FB" />
        <ActionBtn icon="📋" label="GST Return" sub="GSTR-1 / 3B" onClick={() => onNavigate('gst')} color="#FAEEDA" />
        <ActionBtn icon="💾" label="Export JSON" sub="For GST portal" onClick={() => onNavigate('export')} color="#FCEBEB" />
      </div>

      {/* Summary + Recent Sales */}
      <div style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardTitle}>
            <span>Recent Sales</span>
            <button style={S.viewAllBtn} onClick={() => onNavigate('sales')}>View all</button>
          </div>
          {recentSales.length === 0 ? (
            <Empty text="No sales this month" action="Add your first sale" onAction={onAddSale} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr>
                  {['Invoice', 'Customer', 'Amount', 'Type'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentSales.map(s => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F0EEE8' }}>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '11px', color: '#185FA5' }}>{s.invoiceNumber}</td>
                    <td style={{ ...S.td, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.party?.name || 'Walk-in'}</td>
                    <td style={{ ...S.td, fontWeight: '600' }}>{fmt(s.totalAmount)}</td>
                    <td style={S.td}><Badge type={s.supplyType} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={S.card}>
          <div style={S.cardTitle}>GST Summary</div>
          <SumTile label="Output GST (from sales)" value={fmt(summary?.outputGST)} valueColor="#BA7517" />
          <SumTile label="Input Tax Credit (ITC)" value={`−${fmt(summary?.itcAvailable)}`} valueColor="#2D7D46" />
          {summary?.blockedITC > 0 && (
            <SumTile label="Blocked ITC (no GSTIN)" value={fmt(summary?.blockedITC)} valueColor="#A32D2D" />
          )}
          <div style={{ height: '1px', background: '#E2DFD5', margin: '8px 0' }} />
          <div style={{ ...S.sumTile, background: '#FCEBEB' }}>
            <span style={{ ...S.sumLabel, color: '#A32D2D', fontWeight: '600' }}>Net GST to Pay</span>
            <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#A32D2D', fontSize: '18px' }}>{fmt(summary?.netPayable)}</span>
          </div>
          <p style={{ fontSize: '11px', color: '#9E9B93', marginTop: '8px' }}>
            ITC from {summary?.purchasesCount || 0} bills recorded
          </p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ ...S.metricCard, '--accent': color }}>
      <div style={{ ...S.metricBar, background: color }} />
      <div style={S.metricLabel}>{label}</div>
      <div style={S.metricValue}>{value}</div>
      <div style={S.metricSub}>{sub}</div>
    </div>
  );
}

function ActionBtn({ icon, label, sub, onClick, color }) {
  return (
    <div style={{ ...S.actionBtn, background: color }} onClick={onClick}>
      <span style={{ fontSize: '20px' }}>{icon}</span>
      <div>
        <div style={{ fontWeight: '600', fontSize: '13px' }}>{label}</div>
        <div style={{ fontSize: '11px', color: '#6B6960', marginTop: '2px' }}>{sub}</div>
      </div>
    </div>
  );
}

function SumTile({ label, value, valueColor }) {
  return (
    <div style={S.sumTile}>
      <span style={S.sumLabel}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: '600', color: valueColor || '#1A1A18' }}>{value}</span>
    </div>
  );
}

function Badge({ type }) {
  const colors = { B2B: '#E6F1FB', B2CS: '#EAF5EE', B2C: '#F0EEE8' };
  const texts  = { B2B: '#185FA5', B2CS: '#2D7D46', B2C: '#6B6960' };
  return (
    <span style={{ background: colors[type] || '#F0EEE8', color: texts[type] || '#6B6960', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>
      {type}
    </span>
  );
}

function Empty({ text, action, onAction }) {
  return (
    <div style={{ padding: '24px 0', textAlign: 'center' }}>
      <p style={{ color: '#9E9B93', fontSize: '13px' }}>{text}</p>
      {onAction && <button style={{ background: 'none', border: 'none', color: '#2D7D46', cursor: 'pointer', fontWeight: '600', fontSize: '13px', marginTop: '4px', fontFamily: 'inherit' }} onClick={onAction}>{action}</button>}
    </div>
  );
}

const S = {
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' },
  title: { fontSize: '20px', fontWeight: '600', letterSpacing: '-0.3px' },
  sub: { fontSize: '13px', color: '#9E9B93', marginTop: '2px' },
  periodBadge: { background: '#F0EEE8', color: '#6B6960', fontSize: '12px', padding: '5px 12px', borderRadius: '20px', fontWeight: '500' },
  alert: { background: '#FAEEDA', border: '1px solid #FAC775', borderRadius: '10px', padding: '12px 16px', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '20px', fontSize: '13px', color: '#633806' },
  metrics: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '20px' },
  loadingGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' },
  metricCard: { background: '#fff', border: '1px solid #E2DFD5', borderRadius: '14px', padding: '16px', position: 'relative', overflow: 'hidden' },
  metricBar: { position: 'absolute', top: 0, left: 0, right: 0, height: '3px' },
  metricLabel: { fontSize: '11px', color: '#9E9B93', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' },
  metricValue: { fontSize: '22px', fontWeight: '600', letterSpacing: '-0.5px' },
  metricSub: { fontSize: '11px', color: '#9E9B93', marginTop: '4px' },
  skeletonCard: { background: '#F0EEE8', borderRadius: '14px', height: '100px', animation: 'pulse 1.5s infinite' },
  actions: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  actionBtn: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', border: '1px solid #E2DFD5', borderRadius: '14px', cursor: 'pointer', flex: '1', minWidth: '140px', transition: 'transform 0.1s' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  card: { background: '#fff', border: '1px solid #E2DFD5', borderRadius: '14px', padding: '18px' },
  cardTitle: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: '600', fontSize: '14px', marginBottom: '14px' },
  viewAllBtn: { background: 'none', border: '1px solid #E2DFD5', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: '#6B6960', fontFamily: 'inherit' },
  th: { background: '#F7F6F2', padding: '8px 10px', textAlign: 'left', fontSize: '10px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E2DFD5' },
  td: { padding: '9px 10px', verticalAlign: 'middle' },
  sumTile: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#F7F6F2', borderRadius: '8px', marginBottom: '6px' },
  sumLabel: { fontSize: '12px', color: '#6B6960', fontWeight: '500' },
};
