import { postAPI } from './api';

/**
 * API methods only (§11) — no state, no toasts, no navigation.
 * Every method takes an optional `signal` so the caller can abort.
 *
 * There is no register: public sign-up is gone, and only an admin creates
 * accounts (Users module).
 */
const authService = {
  /** 401 "Invalid credentials" and 403 "Account is disabled" render on the form. */
  login: (credentials, signal) => postAPI('/auth/login', credentials, { signal, inlineErrors: true }),

  /** A 401 here is "Current password is incorrect" — never a dead session. */
  changePassword: (payload, signal) =>
    postAPI('/auth/change-password', payload, { signal, inlineErrors: true }),

  /**
   * Always answered with a neutral message so it can't reveal which emails
   * have accounts. The backend may still 500 for an unknown email (a known
   * development leftover) — the caller shows the same neutral message for it,
   * so it must not toast here.
   */
  forgotPassword: (payload, signal) =>
    postAPI('/auth/forgot-password', payload, { signal, silentStatuses: [500] }),

  resetPassword: (payload, signal) => postAPI('/auth/reset-password', payload, { signal }),
};

export default authService;
