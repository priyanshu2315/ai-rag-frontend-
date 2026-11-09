import axios from 'axios';
import { API_BASE_URL } from '../constants/env';
import { MESSAGES } from '../constants/messages';
import errorText, { isRateLimit, rateLimitText } from '../utils/errorText';
import notify from '../utils/notify';

/**
 * The one axios instance (§11.2).
 *
 * Responsibilities that live HERE and nowhere else:
 *   - attach the bearer token
 *   - unwrap the success envelope so callers get `data`, not `res.data.data`
 *   - normalise every failure to `{ code, message, status }`
 *   - toast errors, and stay silent on intentional cancellations
 *   - hand a 401 back to the app so it can log out
 */
const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
});


/**
 * The store wires itself in after it is created (`registerSession` in
 * store.js). Without this indirection axiosClient → slice → service →
 * axiosClient would be a require cycle.
 */
let session = {
  getToken: () => null,
  isAuthenticated: () => false,
  onUnauthorized: () => {},
  onPasswordChangeRequired: () => {},
};

/** Backend code sent with a 403 while the account still has a temporary password. */
export const PASSWORD_CHANGE_REQUIRED = 'PASSWORD_CHANGE_REQUIRED';

/**
 * Statuses a form shows next to its own fields instead of a toast, when the
 * request opts in with `{ inlineErrors: true }`. Login uses it for "Invalid
 * credentials" / "Account is disabled"; change-password for "Current password
 * is incorrect" — a 401 that must NOT end the session.
 */
const INLINE_STATUSES = new Set([400, 401, 403]);

/**
 * Whether the caller asked to handle this failure itself:
 *   `inlineErrors`  — a form shows 400/401/403 next to its fields
 *   `quietNotFound` — a 404 on a document-scoped request means the document
 *                     left this account's roles; the page drops it and says
 *                     so once, instead of a raw "Document not found." toast.
 *   `silentStatuses` — any other statuses the caller turns into its own
 *                     message (e.g. forgot-password's 500, see authService).
 */
const isSilent = (config, status) =>
  (Boolean(config?.inlineErrors) && INLINE_STATUSES.has(status)) ||
  (Boolean(config?.quietNotFound) && status === 404) ||
  (Array.isArray(config?.silentStatuses) && config.silentStatuses.includes(status));

export const registerSession = (handlers) => {
  session = { ...session, ...handlers };
};

/** The current bearer token, for the one caller that cannot use this client. */
export const getAuthToken = () => session.getToken();

/**
 * The app's error policy, extracted so the SSE stream can share it.
 *
 * `services/chatStream.js` talks to the backend with `fetch` (a streamed POST
 * cannot go through axios), which means it skips every interceptor. Rather
 * than let it grow a second, drifting copy of these rules, both paths call
 * this — so a 401 logs out and a 403 reads the same wherever it came from.
 */
export const handleApiError = ({ status, message, code, silent = false }) => {
  // The caller renders this failure itself — no toast, and no sign-out.
  if (silent) return;

  if (status === 403 && code === PASSWORD_CHANGE_REQUIRED) {
    // Not a permission problem: the route guard moves the user to the
    // set-password screen as soon as the flag lands in the store.
    session.onPasswordChangeRequired();
  } else if (status === 401 && session.isAuthenticated()) {
    // A 401 means two different things depending on who is asking.
    // Signed in  -> the token went stale or the account was disabled; sign out.
    // Signed out -> this IS the sign-in attempt; it falls through to a toast.
    session.onUnauthorized();
  } else if (status === 403 && session.isAuthenticated()) {
    notify.error("You don't have permission to do that");
  } else if (status === 429 || isRateLimit(message)) {
    // Every rate limit the app can raise comes from the model provider, and
    // its text is written for whoever holds the account, not whoever is
    // waiting. The status is checked second because the backend catches that
    // 429 and answers with one of its own, leaving the original only in the
    // message.
    notify.error(rateLimitText(message));
  } else {
    notify.error(message);
  }
};

/* ── Request ──────────────────────────────────────────────────────────── */
client.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Backends here answer in one of two shapes:
 *   { success: true, data: <payload> }   → the payload
 *   <payload>                            → itself
 * Everything downstream sees only the payload.
 */
const unwrap = (body) => {
  if (body && typeof body === 'object' && 'data' in body && 'success' in body) {
    return body.data;
  }
  return body;
};

// `errorText` walks the body's `message`/`error` chain, so a provider envelope
// like `{ error: { message } }` normalises to the same string a flat
// `{ error: "text" }` would — and never to an object (§7.2).
const messageFrom = (error) =>
  errorText(error.response?.data, errorText(error.message, MESSAGES.GENERIC_ERROR));

/* ── Response ─────────────────────────────────────────────────────────── */
client.interceptors.response.use(
  (response) => unwrap(response.data),
  (error) => {
    // An aborted request is not a failure — no toast, no error state (§6).
    if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      return Promise.reject({ code: 'ERR_CANCELED', message: 'canceled', canceled: true });
    }

    const status = error.response?.status;
    const message = messageFrom(error);
    // The backend's own code (e.g. PASSWORD_CHANGE_REQUIRED) beats axios's
    // generic ERR_BAD_REQUEST — callers branch on it.
    const code = error.response?.data?.code || error.code || `HTTP_${status || 'NETWORK'}`;

    handleApiError({ status, message, code, silent: isSilent(error.config, status) });

    return Promise.reject({ code, message, status });
  }
);

export default client;
