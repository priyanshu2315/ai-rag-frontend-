import { postAPI } from './api';

/**
 * API methods only (§11) — no state, no toasts, no navigation.
 * Every method takes an optional `signal` so the caller can abort.
 */
const authService = {
  login: (credentials, signal) => postAPI('/auth/login', credentials, { signal }),

  register: (payload, signal) => postAPI('/auth/register', payload, { signal }),
};

export default authService;
