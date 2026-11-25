import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAllChats, fetchChats } from '../redux/actions/chatsActions';
import { selectAllChats } from '../redux/slices/chatsSlice';
import { CHAT_SCOPE } from '../constants/chatScope';
import { MESSAGES } from '../constants/messages';
import notify from '../utils/notify';

/**
 * Loads every user's chats. A 403 means the account is no longer an admin:
 * the slice drops back to "My" and hides the toggle, and this says why — the
 * service keeps that 403 out of the generic "no permission" toast.
 */
export const loadAllChats = (dispatch) => {
  const promise = dispatch(fetchAllChats());
  promise.then((result) => {
    if (fetchAllChats.rejected.match(result) && result.payload?.status === 403) {
      notify.info(MESSAGES.ALL_CHATS_DENIED);
    }
  });
  return promise;
};

/**
 * Re-reads the chat list(s) after an answer settles: always the user's own
 * (titles and order come from it), and the admin "All" list too while that is
 * the scope in use.
 */
export const refreshChats = (dispatch, getState) => {
  dispatch(fetchChats());
  const { scope, allDenied } = getState().chats;
  if (scope === CHAT_SCOPE.ALL && !allDenied) loadAllChats(dispatch);
};

/**
 * Admin "All" chats: fetched while `enabled` (the toggle is on All), aborted
 * on unmount or when the admin switches back to "My" (§6).
 */
export const useAllChats = (enabled) => {
  const dispatch = useDispatch();
  const chats = useSelector(selectAllChats);
  const { loaded, loading, error } = useSelector((state) => state.chats.all);
  const denied = useSelector((state) => state.chats.allDenied);

  useEffect(() => {
    if (!enabled) return undefined;
    const promise = loadAllChats(dispatch);
    return () => promise.abort();
  }, [enabled, dispatch]);

  const reload = useCallback(() => loadAllChats(dispatch), [dispatch]);

  return { chats, loaded, loading, error, denied, reload };
};

export default useAllChats;
