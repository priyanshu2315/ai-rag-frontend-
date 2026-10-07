import { API_BASE_URL } from '../constants/env';
import { getAuthToken, handleApiError } from '../redux/axiosClient';
import errorText from '../utils/errorText';
import { FRAME_BOUNDARY, payloadOf } from './sse';

/**
 * Live document-processing progress — a second SSE reader beside `chatStream`,
 * and outside `api.js` for the same reason (§17): axios cannot hand a body back
 * incrementally, and `EventSource` cannot send the Authorization header.
 *
 * It never throws. The caller runs a reconnect-then-poll policy on top of it,
 * and a result it can branch on is easier to drive than exceptions:
 *
 *   { done: true }                  a `completed` / `failed` event was delivered
 *   { aborted: true }               the caller's signal cancelled it
 *   { error, retryable }            anything else — retryable says whether
 *                                   opening the stream again could help
 */

const TERMINAL_EVENTS = new Set(['completed', 'summary_failed', 'failed']);

const CONNECTION_LOST = 'The connection to the server was lost.';
const CLOSED_EARLY = 'The progress stream closed before processing finished.';

export const watchProgress = async (documentId, { signal, onEvent }) => {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/documents/progress/${documentId}`, {
      headers: { Authorization: `Bearer ${getAuthToken()}`, Accept: 'text/event-stream' },
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') return { aborted: true };
    return { error: CONNECTION_LOST, retryable: true };
  }

  // 401 and 404 come back as ordinary JSON, before any stream header.
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = errorText(data, `Progress request failed (${response.status})`);

    // A stale token has to sign the user out exactly as it does anywhere else.
    // Everything else is reported inline by the panel, not as a second toast.
    if (response.status === 401 || response.status === 403) {
      handleApiError({ status: response.status, message });
    }
    return { error: message, retryable: response.status >= 500 };
  }

  if (!response.body) return { error: CLOSED_EARLY, retryable: true };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let finished = false;

  /** Handles every complete frame in `buffer`, keeping the partial tail. */
  const drain = (flush = false) => {
    const frames = buffer.split(FRAME_BOUNDARY);
    buffer = flush ? '' : (frames.pop() ?? '');

    for (const frame of frames) {
      const payload = payloadOf(frame);
      if (payload === null) continue;

      // A malformed frame is skipped rather than killing a good stream.
      let event;
      try {
        event = JSON.parse(payload);
      } catch {
        continue;
      }
      if (!event || typeof event !== 'object') continue;
      if (event.documentId && event.documentId !== documentId) continue;
      const status = event.status ?? event.data?.status;
      const summaryStatus = event.summaryStatus ?? event.data?.summaryStatus;
      if (!event.type && (status || summaryStatus)) event.type = 'state';
      if (!event.type) continue;

      if (TERMINAL_EVENTS.has(event.type) || status === 'FAILED' ||
        summaryStatus === 'COMPLETED' || summaryStatus === 'FAILED') finished = true;
      onEvent(event);
    }
  };

  let readFailed = false;
  try {
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { value, done } = await reader.read();
      if (done) break;

      // `stream: true` keeps a multi-byte character split across two network
      // chunks from being decoded as garbage.
      buffer += decoder.decode(value, { stream: true });
      drain();
      if (finished) break;
    }

    if (!finished) {
      buffer += decoder.decode();
      drain(true);
    }
  } catch (error) {
    if (error?.name === 'AbortError') return { aborted: true };
    readFailed = true;
  } finally {
    // Release the connection on every path — the backend cleans up on close.
    reader.cancel().catch(() => {});
  }

  if (finished) return { done: true };
  if (signal?.aborted) return { aborted: true };
  return { error: readFailed ? CONNECTION_LOST : CLOSED_EARLY, retryable: true };
};

export default { watchProgress };
