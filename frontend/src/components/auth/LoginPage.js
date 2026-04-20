/**
 * Login Page — OTP-based authentication
 */
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { extractErrors } from '../../utils/helpers';

export default function LoginPage() {
  const { login } = useAuth();
  const [step,    setStep]    = useState('input'); // 'input' | 'otp'
  const [mobile,  setMobile]  = useState('');
  const [otp,     setOtp]     = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequestOTP(e) {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await authAPI.requestOTP({ mobile });
      toast.success(res.data.message || 'OTP sent!');
      if (res.data.devOtp) toast(`Dev OTP: ${res.data.devOtp}`, { icon: '🔑' });
      setStep('otp');
    } catch (err) {
      toast.error(extractErrors(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOTP(e) {
    e.preventDefault();
    if (otp.length !== 6) { toast.error('Enter 6-digit OTP'); return; }
    setLoading(true);
    try {
      const res = await authAPI.verifyOTP({ mobile, otp });
      login(res.data.token, res.data.user);
      toast.success('Logged in successfully!');
    } catch (err) {
      toast.error(extractErrors(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logo}>
          Biz<span style={{ color: '#2D7D46' }}>GST</span>
        </div>
        <p style={styles.tagline}>Smart GST Accounting for Indian Businesses</p>

        {step === 'input' ? (
          <form onSubmit={handleRequestOTP}>
            <label style={styles.label}>Mobile Number</label>
            <input
              style={styles.input}
              type="tel"
              maxLength={10}
              placeholder="9876543210"
              value={mobile}
              onChange={e => setMobile(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <p style={styles.hint}>We'll send a 6-digit OTP to verify your number</p>
            <button style={{ ...styles.btn, opacity: loading ? .7 : 1 }} disabled={loading}>
              {loading ? 'Sending...' : 'Send OTP →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div style={styles.otpHeader}>
              <span>OTP sent to </span>
              <strong>+91 {mobile}</strong>
              <button type="button" style={styles.changeBtn} onClick={() => { setStep('input'); setOtp(''); }}>
                Change
              </button>
            </div>
            <label style={styles.label}>Enter OTP</label>
            <input
              style={{ ...styles.input, letterSpacing: '0.3em', textAlign: 'center', fontSize: '22px' }}
              type="tel"
              maxLength={6}
              placeholder="• • • • • •"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <button style={{ ...styles.btn, opacity: loading ? .7 : 1 }} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Login →'}
            </button>
            <button type="button" style={styles.resendBtn} onClick={() => { setStep('input'); }}>
              Resend OTP
            </button>
          </form>
        )}

        <p style={styles.footer}>
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: '#F7F6F2', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '16px',
  },
  card: {
    background: '#fff', borderRadius: '16px', padding: '40px 36px',
    width: '100%', maxWidth: '400px', border: '1px solid #E2DFD5',
  },
  logo: { fontSize: '28px', fontWeight: '700', letterSpacing: '-1px', marginBottom: '6px' },
  tagline: { color: '#6B6960', fontSize: '14px', marginBottom: '32px' },
  label: { display: 'block', fontSize: '12px', fontWeight: '600', color: '#6B6960', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' },
  input: { width: '100%', padding: '12px 14px', border: '1px solid #E2DFD5', borderRadius: '10px', fontSize: '16px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '8px' },
  hint: { fontSize: '12px', color: '#9E9B93', marginBottom: '20px' },
  btn: { width: '100%', background: '#2D7D46', color: '#fff', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  otpHeader: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#6B6960', marginBottom: '16px', flexWrap: 'wrap' },
  changeBtn: { background: 'none', border: 'none', color: '#2D7D46', cursor: 'pointer', fontWeight: '600', fontSize: '13px', padding: '0', fontFamily: 'inherit' },
  resendBtn: { width: '100%', background: 'none', border: 'none', color: '#6B6960', cursor: 'pointer', padding: '12px', fontSize: '13px', fontFamily: 'inherit', marginTop: '8px' },
  footer: { fontSize: '11px', color: '#9E9B93', textAlign: 'center', marginTop: '24px' },
};
