import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { deleteChat, fetchChats, renameChat } from '../redux/actions/chatsActions';
import { selectChats } from '../redux/slices/chatsSlice';
import notify from '../utils/notify';

/**
 * The user's global chats: loads the list (aborted on unmount, §6) and
 * renames or deletes one. Actions resolve to a boolean; failures were already
 * toasted by the axios layer.
 */
export const useChats = () => {
  const dispatch = useDispatch();
  const chats = useSelector(selectChats);
  const { loaded, loading, error, savingId, deletingId } = useSelector((state) => state.chats);

  useEffect(() => {
    const promise = dispatch(fetchChats());
    return () => promise.abort();
  }, [dispatch]);

  const reload = useCallback(() => dispatch(fetchChats()), [dispatch]);

  const rename = useCallback(async (id, title) => {
    const result = await dispatch(renameChat({ id, title: title.trim() }));
    const ok = renameChat.fulfilled.match(result);
    if (ok) notify.success('Chat renamed');
    return ok;
  }, [dispatch]);

  const remove = useCallback(async (id) => {
    const result = await dispatch(deleteChat(id));
    const ok = deleteChat.fulfilled.match(result);
    if (ok) notify.deleted('Chat');
    return ok;
  }, [dispatch]);

  return { chats, loaded, loading, error, savingId, deletingId, reload, rename, remove };
};

export default useChats;
