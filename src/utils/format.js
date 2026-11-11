/** Presentation-only helpers. No business logic, no API shapes. */

export const formatTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/** 860 → "0.9s", 12400 → "12.4s", 65000 → "1m 05s". */
export const formatDuration = (ms) => {
  if (!Number.isFinite(ms) || ms < 0) return '';
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, '0')}s`;
};

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Initials for the avatar chip — "priya@x.com" → "PR". */
export const initialsFromEmail = (email) => (email || '?').slice(0, 2).toUpperCase();

/** "Priya Singh" → "PS"; falls back to the email's first two letters (name can be null). */
export const initialsOf = ({ name, email } = {}) => {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return initialsFromEmail(email);
};

/** "12 Mar 2026" — a calendar date for lists, in the viewer's locale. */
export const formatDate = (iso) => {
  if (!iso) return '—';
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** Non-cryptographic id for optimistic client-side rows. */
export const localId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Math.random().toString(36).slice(2)}`;

const BREAK_TAG = /<br\s*\/?>/gi;
const BLOCK_END_TAG = /<\/(?:p|div|li|tr|h[1-6])\s*>/gi;
// A letter must follow the bracket, so prose like "a < b" is left alone.
const HTML_TAG = /<\/?[a-zA-Z][^<>]*>/g;
const ENTITY = /&(?:nbsp|amp|lt|gt|quot|apos|#39);/g;

const ENTITIES = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
};

/**
 * Document text back to something readable.
 *
 * The parser emits GitHub-flavoured markdown, and that markdown carries inline
 * HTML — `<br/>` between the lines of a table cell, the occasional wrapper tag.
 * Left alone those render as literal `<br/>` on the page.
 *
 * The result is always a plain string that is rendered as a text node: no
 * caller hands it to `dangerouslySetInnerHTML`, so nothing inside an uploaded
 * document can inject markup into the page.
 */
export const stripHtml = (value) => {
  if (!value) return '';

  return value
    .split('\n')
    .map((line) =>
      // Inside a table row a `<br/>` is a break within one cell, not a new
      // row — a newline there would tear the row into pieces.
      line.replace(BREAK_TAG, line.trimStart().startsWith('|') ? ' ' : '\n')
    )
    .join('\n')
    .replace(BLOCK_END_TAG, '\n')
    .replace(HTML_TAG, '')
    .replace(ENTITY, (entity) => ENTITIES[entity])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/** The same text flattened onto one line, for a truncated preview. */
export const toSingleLine = (value) => stripHtml(value).replace(/\s+/g, ' ');
