import { useCallback, useState } from 'react';

const STORAGE_KEY = 'documind:enter-lock';

const readStored = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    // Private window, blocked site data — the toggle still works, it just
    // is not remembered.
    return false;
  }
};

/**
 * Whether Enter is locked to "new line" in the composer.
 *
 * Off (the default): Enter sends, Shift+Enter breaks the line.
 * On: Enter breaks the line and only the send button sends — so a prompt that
 * needs paragraphs is never fired off half-written.
 *
 * Remembered per browser: it is a habit, not something to re-decide on every
 * reload. Storage is a convenience only, so every access is guarded.
 */
export const useEnterLock = () => {
  const [locked, setLocked] = useState(readStored);

  const toggle = useCallback(() => {
    setLocked((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Not persisted; the in-memory value above still applies.
      }
      return next;
    });
  }, []);

  return [locked, toggle];
};

export default useEnterLock;
