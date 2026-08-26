import { API_BASE_URL } from '../constants/env';
import { getAuthToken, handleApiError } from '../redux/axiosClient';

/**
 * The chat endpoint streams, so this is the one service that does NOT go
 * through `api.js` / `axiosClient` (§17 makes the same exception for SSE).
 *
 * Why it has to: the endpoint is a POST, which rules out `EventSource`
 * (GET-only, and it cannot carry an Authorization header). And axios in the
 * browser cannot hand back a response body incrementally — it resolves once,
 * with the whole thing. So: `fetch` + `response.body.getReader()`.
 *
 * Because it skips the interceptors, it re-attaches the bearer token and
 * routes failures through the shared `handleApiError` policy, so a 401 here
 * behaves exactly like a 401 anywhere else.
 */

const DONE = '[DONE]';

/** Matches an SSE frame boundary — a blank line, tolerating CRLF. */
const FRAME_BOUNDARY = /\r?\n\r?\n/;

const failure = (message, { status, retryable = false, code } = {}) => {
  const error = new Error(message);
  error.status = status;
  error.retryable = retryable;
  error.code = code ?? (status ? `HTTP_${status}` : 'STREAM_ERROR');
  return error;
};

/**
 * Pull the payload out of one frame.
 *
 * SSE allows a frame to carry several `data:` lines, which are joined with
 * newlines; this backend only ever sends one, but honouring the spec costs
 * two lines and removes a way to silently lose text.
 */
const payloadOf = (frame) => {
  const lines = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'));
  if (lines.length === 0) return null;

  // Strip `data:` plus the single optional space the spec allows. Anything
  // beyond that is content and must survive untouched.
  return lines.map((line) => line.slice(line.startsWith('data: ') ? 6 : 5)).join('\n');
};

/**
 * Streams one answer.
 *
 * Calls `onToken(fragment)` for every fragment as it arrives and resolves with
 * the full concatenated text. Fragments are appended verbatim — they are not
 * whole words, so trimming or joining them with spaces would corrupt the answer.
 *
 * Pass `signal` (RTK's `thunkAPI.signal` does nicely) to cancel: the fetch
 * aborts and the rejection carries `name === 'AbortError'`.
 */
export const streamChat = async ({ question, documentId, signal }, onToken) => {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    // Omitted entirely — not sent as null — when the answer should draw on
    // every document the user has.
    body: JSON.stringify(documentId ? { question, documentId } : { question }),
    signal,
  });

  // Errors and "still processing" arrive as plain JSON, before any stream
  // header is written. 202 is the trap here: it is not `ok === false`, but it
  // is not an answer either, so it has to be checked explicitly.
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || response.status === 202 || !contentType.includes('text/event-stream')) {
    const data = await response.json().catch(() => ({}));
    const message = data.error || `Request failed (${response.status})`;

    // A still-processing document is a "try again in a moment", not a failure
    // worth a toast — the retry affordance in the transcript says it better.
    if (response.status === 202) {
      throw failure(message, { status: 202, retryable: true, code: 'STILL_PROCESSING' });
    }

    handleApiError({ status: response.status, message });
    throw failure(message, { status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let full = '';
  let sawDone = false;

  /** Handles every complete frame in `buffer`, keeping the partial tail. */
  const drain = (flush = false) => {
    const frames = buffer.split(FRAME_BOUNDARY);
    // The last piece is only complete if we are flushing what is left at EOF.
    buffer = flush ? '' : (frames.pop() ?? '');

    for (const frame of frames) {
      const payload = payloadOf(frame);
      if (payload === null) continue;

      const trimmed = payload.trim();
      if (trimmed === DONE) {
        sawDone = true;
        continue;
      }

      // A malformed frame is skipped rather than killing a good stream.
      let text;
      try {
        ({ text } = JSON.parse(trimmed));
      } catch {
        continue;
      }

      if (text) {
        full += text;
        onToken(text);
      }
    }
  };

  // A backend that dies mid-answer drops the TCP connection, which surfaces
  // as a bare "Failed to fetch" — useless in the transcript. Both that and a
  // clean close with no [DONE] mean the same thing to the user, so they are
  // reported the same way.
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
    }

    buffer += decoder.decode();
    // A server that closes without a trailing blank line still leaves a valid
    // final frame in the buffer — including, sometimes, [DONE].
    drain(true);
  } catch (error) {
    // An abort is the caller's own doing and has to stay recognisable, so it
    // is the one failure that passes straight through.
    if (error?.name === 'AbortError') throw error;
    readFailed = true;
  } finally {
    // Release the connection on every path, cancellation included.
    reader.cancel().catch(() => {});
  }

  // Whatever text arrived is still returned to the caller by way of the
  // fragments already emitted — but this is a failure, not a whole answer.
  if (readFailed || !sawDone) {
    throw failure('The connection closed before the answer finished.', {
      code: 'STREAM_INTERRUPTED',
    });
  }

  return full;
};

export default { streamChat };
