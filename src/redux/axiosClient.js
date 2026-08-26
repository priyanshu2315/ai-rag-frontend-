import axios from 'axios';
import { API_BASE_URL } from '../constants/env';
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
};

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
export const handleApiError = ({ status, message }) => {
  // A 401 means two different things depending on who is asking.
  // Signed in  -> the token went stale; sign out and say so.
  // Signed out -> this IS the sign-in attempt, and 401 is "wrong password",
  //               which must surface as a normal error toast.
  if (status === 401 && session.isAuthenticated()) {
    session.onUnauthorized();
  } else if (status === 403) {
    notify.error("You don't have permission to do that");
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

const messageFrom = (error) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  error.message ||
  'Something went wrong. Please try again.';

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

    handleApiError({ status, message });

    return Promise.reject({ code: error.code || `HTTP_${status || 'NETWORK'}`, message, status });
  }
);

export default client;
