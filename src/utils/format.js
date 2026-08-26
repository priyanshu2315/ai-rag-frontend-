/** Presentation-only helpers. No business logic, no API shapes. */

export const formatTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Initials for the avatar chip — "priya@x.com" → "PR". */
export const initialsFromEmail = (email) => (email || '?').slice(0, 2).toUpperCase();

/** Non-cryptographic id for optimistic client-side rows. */
export const localId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `local-${Math.random().toString(36).slice(2)}`;
