import { useCallback, useSyncExternalStore } from 'react';

/**
 * Light / dark theme.
 *
 * The source of truth is the `dark` class on <html> — the design tokens in
 * index.css switch on it, and the inline script in index.html sets it before
 * first paint so a dark-mode user never sees a white flash on load. This hook
 * only reads and flips that class; it holds no copy of its own.
 *
 * Dark is the default. Once users toggle, their choice is remembered per
 * browser, independently of the OS setting.
 *
 * Persisted with localStorage rather than redux-persist, which is reserved for
 * auth (§ persist auth only) — same as the composer's Enter lock. Storage is a
 * convenience, so every access is guarded: blocked storage still toggles, it
 * just is not remembered.
 */

const STORAGE_KEY = 'documind:theme';
const currentTheme = () =>
  document.documentElement.classList.contains('dark') ? 'dark' : 'light';

// A module-level store, so every toggle on screen (topbar, auth pages) reads
// the same value and re-renders together.
const listeners = new Set();

/**
 * Flips the class with transitions suspended for that one frame. Without it,
 * the elements that carry `transition-colors` (inputs, buttons, rows) fade
 * over 150ms while everything else snaps, and the switch visibly flickers.
 */
const apply = (theme) => {
  const root = document.documentElement;

  root.classList.add('theme-switching');
  root.classList.toggle('dark', theme === 'dark');
  // Force a style flush so the new colours land while transitions are off.
  window.getComputedStyle(root).getPropertyValue('color');
  requestAnimationFrame(() => root.classList.remove('theme-switching'));

  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useTheme = () => {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'dark');

  const toggle = useCallback(() => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted; the class below still applies for this session.
    }
    apply(next);
  }, []);

  return { theme, toggle };
};

export default useTheme;
