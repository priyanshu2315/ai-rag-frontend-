import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Browser fullscreen for one element: attach `ref`, then `toggle()`.
 * `active` follows the browser too, so Esc (or the browser's own exit) is seen.
 * `supported` is false where elements cannot go fullscreen (e.g. iPhone Safari),
 * so callers can hide their button rather than show one that does nothing.
 */
export const useFullscreen = () => {
  const ref = useRef(null);
  const [active, setActive] = useState(false);
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled === true;

  useEffect(() => {
    if (!supported) return undefined;
    const onChange = () => setActive(document.fullscreenElement != null && document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [supported]);

  const toggle = useCallback(() => {
    if (!supported) return;
    // A refused request (no user gesture, permissions policy) just leaves the page as it was.
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else ref.current?.requestFullscreen().catch(() => {});
  }, [supported]);

  return { ref, active, supported, toggle };
};

export default useFullscreen;
