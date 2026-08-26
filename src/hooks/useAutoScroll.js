import { useEffect, useRef } from 'react';

/**
 * Keeps a scroll container pinned to the bottom as new content arrives.
 *
 * Two things make this more than a one-line `scrollIntoView`:
 *
 * 1. **Pin only when the user is already at the bottom.** Scrolling back
 *    through the transcript must not be yanked away by an arriving answer.
 * 2. **Re-pin as the content grows.** A markdown answer reflows *after* it
 *    mounts (tables, code blocks, web fonts settling), so scrolling once when
 *    the message count changes lands short and cuts the answer off. A
 *    ResizeObserver on the content re-pins until the height settles.
 *
 * Returns both refs: `containerRef` on the scroller, `contentRef` on the
 * element inside it that actually grows.
 */
export const useAutoScroll = (deps, threshold = 120) => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const pinnedRef = useRef(true);

  // Track whether the user is sitting near the bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const onScroll = () => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [threshold]);

  // Follow the content while it settles — jump, don't animate, or each
  // observed growth would restart a smooth scroll and fight the last one.
  useEffect(() => {
    const el = containerRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) el.scrollTop = el.scrollHeight;
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Smooth-scroll on the actual event (a message was sent or received).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !pinnedRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { containerRef, contentRef };
};

export default useAutoScroll;
