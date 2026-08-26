/**
 * Storage adapter for redux-persist.
 *
 * We do NOT import `redux-persist/lib/storage`: it is CJS, and under Vite's
 * ESM interop the default export arrives as a namespace object, so
 * `storage.getItem` is undefined and the store throws on the first REHYDRATE.
 *
 * The contract is only three promise-returning methods, so declaring them here
 * is both smaller than the workaround and safe when localStorage throws
 * (private mode, blocked site data, quota) — persistence degrades to
 * in-memory rather than taking the app down.
 */
const memory = new Map();

const hasLocalStorage = (() => {
  try {
    const probe = '__persist_probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
})();

const persistStorage = {
  getItem: (key) =>
    Promise.resolve(hasLocalStorage ? window.localStorage.getItem(key) : memory.get(key) ?? null),

  setItem: (key, value) => {
    if (hasLocalStorage) window.localStorage.setItem(key, value);
    else memory.set(key, value);
    return Promise.resolve(value);
  },

  removeItem: (key) => {
    if (hasLocalStorage) window.localStorage.removeItem(key);
    else memory.delete(key);
    return Promise.resolve();
  },
};

export default persistStorage;
