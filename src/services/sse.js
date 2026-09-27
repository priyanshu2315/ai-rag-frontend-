/**
 * Frame parsing shared by the two services that read Server-Sent Events over
 * `fetch` (`chatStream`, `progressStream`). Neither can use `EventSource`:
 * it cannot carry an Authorization header.
 */

/** Matches an SSE frame boundary — a blank line, tolerating CRLF. */
export const FRAME_BOUNDARY = /\r?\n\r?\n/;

/**
 * Pull the payload out of one frame.
 *
 * SSE allows a frame to carry several `data:` lines, which are joined with
 * newlines; this backend only ever sends one, but honouring the spec costs
 * two lines and removes a way to silently lose text.
 */
export const payloadOf = (frame) => {
  const lines = frame.split(/\r?\n/).filter((line) => line.startsWith('data:'));
  if (lines.length === 0) return null;

  // Strip `data:` plus the single optional space the spec allows. Anything
  // beyond that is content and must survive untouched.
  return lines.map((line) => line.slice(line.startsWith('data: ') ? 6 : 5)).join('\n');
};
