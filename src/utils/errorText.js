import { MESSAGES } from '../constants/messages';

/**
 * An upstream error the backend stringified into its own message, as in
 * `429 {"error":{"message":"Rate limit reached …"}}`.
 *
 * Only a parse that yields an error-shaped object counts, so prose that merely
 * happens to contain braces is left exactly as it is.
 */
const unwrapEmbedded = (text) => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    const shaped = parsed && typeof parsed === 'object' && (parsed.message || parsed.error);
    return shaped ? parsed : null;
  } catch {
    return null;
  }
};

/**
 * A displayable string out of whatever shape an error arrived in.
 *
 * Backends here answer with `{ error: "text" }`, but an error forwarded from
 * the model provider arrives two other ways too: as that provider's own
 * envelope (`{ error: { message, type, code } }`), and as the whole thing
 * flattened into a string the backend built itself.
 *
 * That difference is not cosmetic. Everything downstream eventually renders
 * this value, and an object handed to React as a child throws during render,
 * which unmounts the whole tree: a rate limit on one question would otherwise
 * take the entire app down with it. Nothing may leave here but a string.
 */
export const errorText = (value, fallback = MESSAGES.GENERIC_ERROR) => {
  if (typeof value === 'string') {
    const embedded = unwrapEmbedded(value);
    if (embedded) return errorText(embedded, fallback);

    return value.trim() || fallback;
  }

  if (value && typeof value === 'object') {
    const nested = value.message ?? value.error;
    if (nested && nested !== value) return errorText(nested, fallback);
  }

  return fallback;
};

/**
 * The wait in a provider's rate-limit prose ("try again in 5m45.6s").
 *
 * Longest unit first: `minutes` has to be tried before `m`, or "5 minutes"
 * comes back as "5 m".
 */
const RETRY_AFTER =
  /try again in ((?:\d+(?:\.\d+)?\s*(?:hours?|minutes?|seconds?|ms|h|m|s)\s*)+)/i;

/**
 * A rate limit in the words of whoever is waiting on it.
 *
 * The provider's own text names the organisation, the model, the token budget
 * and a billing URL — none of which belongs in front of someone who just asked
 * a question. The wait is the only part worth keeping.
 *
 * Applying it to an already-friendly string is a no-op, so it is safe wherever
 * a 429 surfaces.
 */
export const rateLimitText = (value) => {
  const wait = RETRY_AFTER.exec(errorText(value))?.[1].trim();
  return wait ? `${MESSAGES.RATE_LIMITED} Try again in ${wait}.` : MESSAGES.RATE_LIMITED;
};

const RATE_LIMIT = /rate[\s_-]?limit|too many requests|quota exceeded/i;

/**
 * Whether a failure is a rate limit, judged by what it says rather than by the
 * status it arrived with.
 *
 * The status cannot be trusted for this: the backend catches the provider's
 * 429 and answers with a status of its own, leaving the original only in the
 * text — which is why matching on 429 alone let the raw provider blob through
 * to the transcript.
 */
export const isRateLimit = (value) => RATE_LIMIT.test(errorText(value, ''));

export default errorText;
