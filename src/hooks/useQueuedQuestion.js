import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Asks the question the header search left in router state (`{ ask, askedAt }`)
 * once the chat is ready to take it.
 *
 * It waits for `ready` (the right conversation is loaded) and for any answer
 * still streaming to finish, sends exactly once per search — `askedAt` tells
 * two identical searches apart — and then clears the state so a refresh or a
 * back-navigation does not ask it again.
 */
export const useQueuedQuestion = ({ enabled, ready, sending, send }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const handled = useRef(null);
  const ask = location.state?.ask;
  const askedAt = location.state?.askedAt;

  useEffect(() => {
    if (!enabled || !ask || !ready || sending || handled.current === askedAt) return;
    handled.current = askedAt;
    send(ask);
    navigate(location.pathname, { replace: true, state: null });
  }, [enabled, ask, askedAt, ready, sending, send, navigate, location.pathname]);
};

export default useQueuedQuestion;
