/**
 * Custom hooks — data fetching with loading/error state
 */
import { useState, useEffect, useCallback } from 'react';
import { salesAPI, purchasesAPI, productsAPI, gstAPI, partiesAPI } from '../services/api';

/**
 * Generic fetch hook
 */
function useFetch(fetchFn, deps = [], immediate = true) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error,   setError]   = useState(null);

  const execute = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn(...args);
      setData(res.data.data ?? res.data);
      return res.data;
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Something went wrong';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => {
    if (immediate) execute();
  }, [execute]); // eslint-disable-line

  return { data, loading, error, refetch: execute };
}

// ── Specific hooks ────────────────────────────

export function useSales(params) {
  return useFetch(() => salesAPI.list(params), [JSON.stringify(params)]);
}

export function usePurchases(params) {
  return useFetch(() => purchasesAPI.list(params), [JSON.stringify(params)]);
}

export function useProducts() {
  return useFetch(() => productsAPI.list(), []);
}

export function useParties(type) {
  return useFetch(() => partiesAPI.list({ type }), [type]);
}

export function useGSTSummary(period) {
  return useFetch(() => gstAPI.summary(period), [period]);
}

/**
 * Period selector — returns current MMYYYY period and helpers
 */
export function usePeriod() {
  const now   = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year  = now.getFullYear();
  const [period, setPeriod] = useState(`${month}${year}`);

  const periodLabel = () => {
    const m = parseInt(period.slice(0, 2)) - 1;
    const y = parseInt(period.slice(2));
    return new Date(y, m, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  return { period, setPeriod, periodLabel };
}
