/**
 * Business Setup Page — shown after first login
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { businessAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { validateGSTIN, INDIAN_STATES, extractErrors } from '../../utils/helpers';

export default function BusinessSetup() {
  const { refreshBusiness } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', gstin: '', address: '', businessType: 'RETAIL',
  });
  const [gstinError, setGstinError] = useState('');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === 'gstin' ? value.toUpperCase() : value }));
    if (name === 'gstin') {
      if (value.length === 15) {
        setGstinError(validateGSTIN(value) ? '' : 'Invalid GSTIN format');
      } else {
        setGstinError('');
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validateGSTIN(form.gstin)) { toast.error('Please enter a valid GSTIN'); return; }
    setLoading(true);
    try {
      await businessAPI.create(form);
      await refreshBusiness();
      toast.success('Business profile created!');
    } catch (err) {
      toast.error(extractErrors(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>Biz<span style={{ color: '#2D7D46' }}>GST</span></div>
        <h2 style={styles.title}>Set up your business</h2>
        <p style={styles.sub}>This takes 30 seconds — we'll handle all the GST math from here</p>

        <form onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Business Name *</label>
            <input style={styles.input} name="name" value={form.name} onChange={handleChange} placeholder="e.g. Sharma Electronics" required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>GSTIN *</label>
            <input
              style={{ ...styles.input, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em', borderColor: gstinError ? '#A32D2D' : undefined }}
              name="gstin" value={form.gstin} onChange={handleChange}
              placeholder="27ABCDE1234F1Z5" maxLength={15} required
            />
            {gstinError
              ? <span style={styles.errorHint}>{gstinError}</span>
              : form.gstin.length === 15 && <span style={styles.successHint}>✓ Valid GSTIN</span>}
            <span style={styles.hint}>Your 15-character GST number — found on your GST certificate</span>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Business Address</label>
            <input style={styles.input} name="address" value={form.address} onChange={handleChange} placeholder="Shop no, street, city, pincode" />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Business Type</label>
            <select style={styles.input} name="businessType" value={form.businessType} onChange={handleChange}>
              <option value="RETAIL">Retail Shop</option>
              <option value="WHOLESALE">Wholesale / Distributor</option>
              <option value="MANUFACTURER">Manufacturer</option>
              <option value="SERVICE">Service Provider</option>
            </select>
          </div>

          <button style={{ ...styles.btn, opacity: loading ? .7 : 1 }} disabled={loading}>
            {loading ? 'Setting up...' : 'Start Using BizGST →'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#F7F6F2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' },
  card: { background: '#fff', borderRadius: '16px', padding: '40px 36px', width: '100%', maxWidth: '480px', border: '1px solid #E2DFD5' },
  logo: { fontSize: '22px', fontWeight: '700', letterSpacing: '-0.5px', marginBottom: '16px' },
  title: { fontSize: '20px', fontWeight: '600', marginBottom: '6px', letterSpacing: '-0.3px' },
  sub: { color: '#6B6960', fontSize: '14px', marginBottom: '28px' },
  field: { marginBottom: '18px' },
  label: { display: 'block', fontSize: '11px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #E2DFD5', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
  hint: { display: 'block', fontSize: '11px', color: '#9E9B93', marginTop: '4px' },
  successHint: { display: 'block', fontSize: '11px', color: '#2D7D46', marginTop: '4px', fontWeight: '600' },
  errorHint: { display: 'block', fontSize: '11px', color: '#A32D2D', marginTop: '4px' },
  btn: { width: '100%', background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit', marginTop: '8px' },
};
