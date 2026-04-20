/**
 * API Service
 * Central axios instance — auto-attaches JWT, handles 401 logout
 */
import axios from 'axios';
import toast from 'react-hot-toast';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach JWT ──────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('bizgst_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: handle errors globally ─────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      toast.error('Cannot connect to server. Check your internet connection.');
      return Promise.reject(error);
    }

    const { status, data } = error.response;

    if (status === 401) {
      localStorage.removeItem('bizgst_token');
      localStorage.removeItem('bizgst_user');
      // Redirect to login without React Router dependency
      if (!window.location.pathname.includes('/login')) {
        toast.error('Session expired. Please login again.');
        setTimeout(() => { window.location.href = '/login'; }, 1500);
      }
    } else if (status === 422) {
      // Validation errors — let component handle
    } else if (status === 429) {
      toast.error('Too many requests. Please wait a moment.');
    } else if (status >= 500) {
      toast.error('Server error. Please try again.');
    }

    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────
export const authAPI = {
  requestOTP:  (data) => api.post('/auth/otp-request', data),
  verifyOTP:   (data) => api.post('/auth/otp-verify', data),
  getProfile:  ()     => api.get('/auth/profile'),
};

// ── Business ──────────────────────────────────
export const businessAPI = {
  get:    ()     => api.get('/business'),
  create: (data) => api.post('/business', data),
  update: (data) => api.put('/business', data),
};

// ── Sales ─────────────────────────────────────
export const salesAPI = {
  list:   (params) => api.get('/sales', { params }),
  get:    (id)     => api.get(`/sales/${id}`),
  create: (data)   => api.post('/sales', data),
  cancel: (id)     => api.delete(`/sales/${id}`),
};

// ── Purchases ─────────────────────────────────
export const purchasesAPI = {
  list:   (params) => api.get('/purchases', { params }),
  get:    (id)     => api.get(`/purchases/${id}`),
  create: (data)   => api.post('/purchases', data),
};

// ── Products ──────────────────────────────────
export const productsAPI = {
  list:   ()       => api.get('/products'),
  create: (data)   => api.post('/products', data),
  update: (id, d)  => api.put(`/products/${id}`, d),
  remove: (id)     => api.delete(`/products/${id}`),
};

// ── Parties ───────────────────────────────────
export const partiesAPI = {
  list:   (params) => api.get('/parties', { params }),
  create: (data)   => api.post('/parties', data),
};

// ── GST ───────────────────────────────────────
export const gstAPI = {
  summary: (period) => api.get('/gst/summary', { params: { period } }),
  gstr1:   (period) => api.get('/gst/gstr1',   { params: { period } }),
  gstr3b:  (period) => api.get('/gst/gstr3b',  { params: { period } }),
};

// ── Export ────────────────────────────────────
export const exportAPI = {
  gstr1:  (period) => api.get('/export/gstr1',  { params: { period }, responseType: 'blob' }),
  gstr3b: (period) => api.get('/export/gstr3b', { params: { period }, responseType: 'blob' }),
};

export default api;
