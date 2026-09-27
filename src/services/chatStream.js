import { API_BASE_URL } from '../constants/env';
import { getAuthToken, handleApiError } from '../redux/axiosClient';
import { MESSAGES } from '../constants/messages';
import errorText, { isRateLimit, rateLimitText } from '../utils/errorText';
import notify from '../utils/notify';
import { FRAME_BOUNDARY, payloadOf } from './sse';

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

/**
 * A 500 whose message says the background worker failed on this document.
 * Matched on the text because the backend gives it no distinct status code.
 */
const PROCESSING_FAILED = /processing failed/i;

const failure = (message, { status, retryable = false, code } = {}) => {
  const error = new Error(message);
  error.status = status;
  error.retryable = retryable;
  error.code = code ?? (status ? `HTTP_${status}` : 'STREAM_ERROR');
  return error;
};

/**
 * Streams one answer.
 *
 * Calls `onEvent` for every frame the agent emits — the status transitions and
 * tool calls it makes on the way to an answer, then the answer itself, one
 * fragment at a time — and resolves with the full concatenated text. Fragments
 * are appended verbatim: they are not whole words, so trimming them or joining
 * them with spaces would corrupt the answer.
 *
 * Events reach the caller in the backend's own vocabulary (`status`,
 * `tool_start`, `tool_finish`, `token`), because deciding what a tool call
 * looks like on screen is not this layer's business. The two frames that end
 * the stream — `done` and `error` — are handled here instead, since they
 * decide whether this call resolves or throws.
 *
 * Pass `signal` (RTK's `thunkAPI.signal` does nicely) to cancel: the fetch
 * aborts and the rejection carries `name === 'AbortError'`.
 */
export const streamChat = async ({ question, documentId, conversationId, signal }, onEvent) => {
  // The history array is deliberately absent: the backend threads context off
  // `conversationId` itself, so re-sending the transcript would be dead weight.
  // Both ids are omitted entirely — never sent as null — when absent, since
  // "no documentId" is what tells the backend to search every document.
  const payload = { question };
  if (documentId) payload.documentId = documentId;
  if (conversationId) payload.conversationId = conversationId;

  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(payload),
    signal,
  });

  // Errors and "still processing" arrive as plain JSON, before any stream
  // header is written. 202 is the trap here: it is not `ok === false`, but it
  // is not an answer either, so it has to be checked explicitly.
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || response.status === 202 || !contentType.includes('text/event-stream')) {
    const data = await response.json().catch(() => ({}));
    const message = errorText(data, `Request failed (${response.status})`);

    // 202: summarising and vectorising happen in the background, so the user
    // can beat the worker to the answer. That is a "try again in a moment",
    // not a failure — hence an info toast plus the retry affordance in the
    // transcript, and never the red error toast the shared policy would raise.
    if (response.status === 202) {
      notify.info(MESSAGES.STILL_PROCESSING);
      throw failure(MESSAGES.STILL_PROCESSING, {
        status: 202,
        retryable: true,
        code: 'STILL_PROCESSING',
      });
    }

    // The worker crashed on this file: waiting will never fix it, so this is
    // the one failure that must NOT offer a retry. It gets a persistent error
    // state in the transcript telling the user to re-upload, rather than a
    // toast that scrolls away with the instruction in it.
    if (PROCESSING_FAILED.test(message)) {
      throw failure(MESSAGES.PROCESSING_FAILED, {
        status: response.status,
        code: 'PROCESSING_FAILED',
      });
    }

    // The model provider ran out of quota, not the user's doing and not
    // permanent — so it reads as "come back in a minute", with the wait time
    // kept and the retry affordance left in the transcript.
    //
    // Matched on the text as well as the status: the backend catches the
    // provider's 429 and answers with a status of its own, so the only
    // reliable trace of a rate limit is what the message says.
    if (response.status === 429 || isRateLimit(message)) {
      handleApiError({ status: response.status, message });
      throw failure(rateLimitText(message), {
        status: response.status,
        retryable: true,
        code: 'RATE_LIMITED',
      });
    }

    handleApiError({ status: response.status, message });
    throw failure(message, { status: response.status });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';
  let full = '';
  let sawDone = false;
  let streamError = null;

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
      let parsed;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        continue;
      }

      switch (parsed?.type) {
        case 'done':
          sawDone = true;
          break;

        // The agent calls the model more than once per answer, so a quota can
        // run out after the stream has already opened. Without reading this
        // the stream would just stop and be reported as a dropped connection,
        // hiding the real reason.
        case 'error':
          streamError = errorText(parsed, MESSAGES.CHAT_ERROR);
          break;

        case 'status':
        case 'tool_start':
        case 'tool_finish':
          onEvent(parsed);
          break;

        default: {
          // An untyped frame carrying `error` is the older error shape.
          if (parsed?.error) {
            streamError = errorText(parsed, MESSAGES.CHAT_ERROR);
            break;
          }

          // `type: "token"` lands here alongside the untyped `{ text }` frame
          // the backend sent before it grew event types — both are answer text
          // and there is nothing to gain from telling them apart.
          const { text } = parsed ?? {};
          if (text) {
            full += text;
            onEvent({ type: 'token', text });
          }
          break;
        }
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

  // A reported failure beats an inferred one: the frame said what went wrong,
  // so it is raised ahead of the generic "the connection stopped" below.
  if (streamError) {
    const limited = isRateLimit(streamError);

    handleApiError({ status: limited ? 429 : undefined, message: streamError });
    throw failure(limited ? rateLimitText(streamError) : streamError, {
      retryable: limited,
      code: limited ? 'RATE_LIMITED' : 'STREAM_ERROR',
    });
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
