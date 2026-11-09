import { useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { createChat } from '../redux/actions/chatsActions';
import { chatPath } from '../constants/routes';

/**
 * Creates a global chat and opens it — the only way one is created, so a
 * chat exists only once the user clicks "New chat" or asks a first question.
 *
 * With a `question`, it travels in router state and the chat page asks it as
 * soon as the new conversation has loaded (`useQueuedQuestion`).
 */
export const useStartChat = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();
  const creating = useSelector((state) => state.chats.creating);

  const start = useCallback(
    async (question) => {
      // Read live state, so a double click cannot create two chats.
      if (store.getState().chats.creating) return false;

      const result = await dispatch(createChat({}));
      const id = createChat.fulfilled.match(result) ? result.payload?.id : null;
      if (!id) return false;

      navigate(chatPath(id), question ? { state: { ask: question, askedAt: Date.now() } } : undefined);
      return true;
    },
    [dispatch, navigate, store]
  );

  return { start, creating };
};

export default useStartChat;
