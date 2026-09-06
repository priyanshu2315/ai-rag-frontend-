import { useCallback, useEffect, useRef, useState } from 'react';

/** How long after a programmatic scroll the container's own events are ignored. */
const SCROLL_SETTLE_MS = 500;

/**
 * Keeps a scroll container pinned to the bottom as new content arrives.
 *
 * Three things make this more than a one-line `scrollIntoView`:
 *
 * 1. **Pin only when the user is already at the bottom.** Scrolling back
 *    through the transcript must not be yanked away by an arriving answer.
 * 2. **Follow content growth, not just new messages.** A streamed answer grows
 *    token by token without the message count ever changing, and markdown
 *    reflows again after it mounts (tables, code blocks, fonts settling). A
 *    ResizeObserver re-pins on every height change.
 * 3. **Ignore our own animation, but nothing else.** A smooth scroll reports
 *    dozens of positions on its way down, and reading "not at the bottom yet"
 *    from one of them would unpin mid-animation. Only that animation is
 *    ignored: the jumps that follow the stream land exactly at the bottom, so
 *    they read as pinned on their own and a scroll away from the bottom is
 *    always the user's. Suppressing events for the stream's jumps too would
 *    mean the window never closes while an answer is arriving, and scrolling
 *    back through it would be impossible.
 *
 * The nodes are held in state rather than in plain refs so the observers
 * attach when the elements actually mount: the list renders a spinner first
 * and swaps in the scroller later, and effects keyed on a ref would have run
 * against `null` and never run again.
 *
 * Returns both callback refs: `containerRef` on the scroller, `contentRef` on
 * the element inside it that grows.
 */
export const useAutoScroll = (deps, threshold = 120) => {
  const [container, setContainer] = useState(null);
  const [content, setContent] = useState(null);

  const pinnedRef = useRef(true);
  const settleAtRef = useRef(0);

  const scrollToBottom = useCallback(
    (behavior) => {
      if (!container) return;

      if (behavior === 'smooth') {
        settleAtRef.current = Date.now() + SCROLL_SETTLE_MS;
        container.scrollTo({ top: container.scrollHeight, behavior });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    },
    [container]
  );

  // Track whether the user is sitting near the bottom.
  useEffect(() => {
    if (!container) return undefined;

    const onScroll = () => {
      if (Date.now() < settleAtRef.current) return;
      pinnedRef.current =
        container.scrollHeight - container.scrollTop - container.clientHeight <= threshold;
    };

    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, [container, threshold]);

  // Follow the content while it grows — jump, don't animate, or every token
  // would restart a smooth scroll and fight the one before it.
  useEffect(() => {
    if (!container || !content || typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(() => {
      if (pinnedRef.current) scrollToBottom();
    });

    observer.observe(content);
    return () => observer.disconnect();
  }, [container, content, scrollToBottom]);

  // Smooth-scroll on the actual event (a message was sent or received).
  useEffect(() => {
    if (pinnedRef.current) scrollToBottom('smooth');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, scrollToBottom]);

  return { containerRef: setContainer, contentRef: setContent };
};

export default useAutoScroll;
