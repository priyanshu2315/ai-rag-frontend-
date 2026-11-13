import { useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useMatch, useNavigate } from 'react-router-dom';
import { createChat } from '../redux/actions/chatsActions';
import { ROUTES, chatPath } from '../constants/routes';
import useActiveChatId from './useActiveChatId';
import { contextKey } from '../redux/slices/chatSlice';

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
  const chatId = useActiveChatId();
  const onNewScreen = Boolean(useMatch({ path: ROUTES.CHAT, end: true }));
  // Already in a conversation nobody has written in: another one would just be a second empty chat.
  const inEmptyChat = useSelector((state) => Boolean(chatId)
    && state.chat.activeKey === contextKey({ chatId })
    && Boolean(state.chat.conversationId)
    && !state.chat.loading
    && state.chat.messages.length === 0);
  const inNewChat = onNewScreen || inEmptyChat;

  const start = useCallback(
    async (question) => {
      // Read live state, so a double click cannot create two chats.
      if (store.getState().chats.creating) return false;
      // A first question may leave the new-chat screen; a bare "New chat" may not.
      if (!question && inNewChat) return false;

      const result = await dispatch(createChat({}));
      const id = createChat.fulfilled.match(result) ? result.payload?.id : null;
      if (!id) return false;

      navigate(chatPath(id), question ? { state: { ask: question, askedAt: Date.now() } } : undefined);
      return true;
    },
    [dispatch, navigate, store, inNewChat]
  );

  return { start, creating, inNewChat };
};

export default useStartChat;
