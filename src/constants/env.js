/**
 * Runtime env (§17).
 *
 * Never read `import.meta.env` in app code — import from here instead.
 * Vite inlines `VITE_*` at build time, so a container image built once can
 * still be pointed at a different API by serving `/env.js` (which sets
 * `window.__ENV__`) before the bundle loads.
 *
 * Precedence: window.__ENV__  →  import.meta.env  →  default.
 */
const RUNTIME = typeof window !== 'undefined' ? window.__ENV__ || {} : {};

const read = (key, fallback) => {
  const value = RUNTIME[key] ?? import.meta.env[key];
  return value === undefined || value === '' ? fallback : value;
};

export const API_BASE_URL = read('VITE_API_BASE_URL', 'http://localhost:3000/api');

export const USE_MOCKS = String(read('VITE_USE_MOCKS', 'false')) === 'true';

export const IS_DEV = import.meta.env.DEV;

const exchangeRate = Number(read('VITE_USD_INR_RATE', ''));
export const USD_INR_RATE = Number.isFinite(exchangeRate) && exchangeRate > 0 ? exchangeRate : null;
export const USD_INR_RATE_SOURCE = read('VITE_USD_INR_RATE_SOURCE', 'Not configured');
export const USD_INR_RATE_DATE = read('VITE_USD_INR_RATE_DATE', 'Not configured');
