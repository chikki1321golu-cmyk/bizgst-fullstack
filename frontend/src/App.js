import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/auth/LoginPage';
import BusinessSetup from './components/auth/BusinessSetup';
import Dashboard from './components/dashboard/Dashboard';
import { SalesList } from './components/sales/SalesList';
import AddSaleModal from './components/sales/AddSaleModal';
import { PurchasesList, AddPurchaseModal } from './components/purchases/Purchases';
import ProductsPage from './components/products/ProductsPage';
import GSTReturns from './components/gst/GSTReturns';

function AppShell() {
  const { user, business, loading, logout } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const [refresh, setRefresh] = useState(0);

  if (loading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:'22px', fontWeight:'700', letterSpacing:'-0.5px', marginBottom:'8px' }}>Biz<span style={{color:'#2D7D46'}}>GST</span></div>
          <div style={{ fontSize:'13px', color:'#9E9B93' }}>Loading your account...</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;
  if (!business) return <BusinessSetup />;

  const navItems = [
    { id:'dashboard', label:'Dashboard',   icon:'▦' },
    { id:'sales',     label:'Sales',       icon:'🧾' },
    { id:'purchases', label:'Purchases',   icon:'📥' },
    { id:'products',  label:'Products',    icon:'📦' },
    { id:'gst',       label:'GST Returns', icon:'📋', badge:true },
  ];

  function handleSuccess() {
    setModal(null);
    setRefresh(r => r + 1);
  }

  const pageComponents = {
    dashboard: <Dashboard key={refresh} onNavigate={setPage} onAddSale={() => setModal('sale')} onAddPurchase={() => setModal('purchase')} />,
    sales:     <SalesList key={refresh} onAddSale={() => setModal('sale')} />,
    purchases: <PurchasesList key={refresh} onAddPurchase={() => setModal('purchase')} />,
    products:  <ProductsPage />,
    gst:       <GSTReturns />,
  };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', fontFamily:'DM Sans, sans-serif', background:'#F7F6F2', color:'#1A1A18' }}>
      {/* ── Sidebar ── */}
      <nav style={{ width:'220px', background:'#fff', borderRight:'1px solid #E2DFD5', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'20px 16px 16px', borderBottom:'1px solid #E2DFD5' }}>
          <div style={{ fontSize:'19px', fontWeight:'700', letterSpacing:'-0.5px' }}>
            Biz<span style={{ color:'#2D7D46' }}>GST</span>
          </div>
          <div style={{ fontSize:'11px', color:'#9E9B93', marginTop:'2px' }}>Smart GST Accounting</div>
        </div>

        <div style={{ padding:'10px 8px', flex:1, overflowY:'auto' }}>
          <div style={{ fontSize:'10px', fontWeight:'600', color:'#9E9B93', letterSpacing:'0.08em', textTransform:'uppercase', padding:'8px 8px 4px' }}>Main</div>
          {navItems.map(n => (
            <div
              key={n.id}
              onClick={() => setPage(n.id)}
              style={{
                display:'flex', alignItems:'center', gap:'10px',
                padding:'8px 10px', borderRadius:'8px', cursor:'pointer',
                marginBottom:'2px', fontSize:'13px', transition:'all 0.1s',
                background: page === n.id ? '#EAF5EE' : 'transparent',
                color:      page === n.id ? '#2D7D46' : '#6B6960',
                fontWeight: page === n.id ? '500' : '400',
              }}
            >
              <span style={{ fontSize:'14px', width:'16px', textAlign:'center' }}>{n.icon}</span>
              {n.label}
              {n.badge && (
                <span style={{ marginLeft:'auto', background:'#A32D2D', color:'#fff', fontSize:'9px', padding:'1px 5px', borderRadius:'20px', fontWeight:'700' }}>!</span>
              )}
            </div>
          ))}
        </div>

        {/* Business badge */}
        <div style={{ padding:'12px 16px', borderTop:'1px solid #E2DFD5' }}>
          <div style={{ fontSize:'12px', fontWeight:'600', color:'#1A1A18', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{business.name}</div>
          <div style={{ fontFamily:'monospace', fontSize:'10px', color:'#9E9B93', marginTop:'2px' }}>{business.gstin}</div>
          <div style={{ fontSize:'11px', color:'#9E9B93', marginTop:'2px' }}>{business.stateName}</div>
          <button
            onClick={logout}
            style={{ marginTop:'8px', background:'none', border:'none', color:'#9E9B93', cursor:'pointer', fontSize:'11px', padding:'0', fontFamily:'inherit' }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main style={{ flex:1, overflowY:'auto', padding:'24px' }}>
        {pageComponents[page] || pageComponents.dashboard}
      </main>

      {/* ── Modals ── */}
      {modal === 'sale' && (
        <AddSaleModal onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
      {modal === 'purchase' && (
        <AddPurchaseModal onClose={() => setModal(null)} onSuccess={handleSuccess} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontSize:'13px', fontFamily:'DM Sans, sans-serif', borderRadius:'10px', border:'1px solid #E2DFD5' },
          success: { iconTheme: { primary:'#2D7D46', secondary:'#fff' } },
        }}
      />
      <AppShell />
    </AuthProvider>
  );
}
