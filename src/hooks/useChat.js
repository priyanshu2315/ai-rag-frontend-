import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { askQuestion, deleteConversation, fetchConversation } from '../redux/actions/chatActions';
import { askedQuestion, clearChat, contextKey, droppedLastAnswer } from '../redux/slices/chatSlice';
import { fetchChats, renameChat } from '../redux/actions/chatsActions';
import { chatTitled } from '../redux/slices/chatsSlice';
import { chatTitleFromQuestion, isDefaultChatTitle } from '../utils/chatTitle';
import useActiveDocumentId from './useActiveDocumentId';
import useActiveChatId from './useActiveChatId';
import notify from '../utils/notify';

/**
 * Answers still streaming, by context. Module-level on purpose: an answer
 * outlives the page's visit to another document, and Stop must still reach it
 * when the user comes back and this hook is a different instance.
 */
const streams = new Map();

/**
 * Owns the conversation for the current context, the send sequence, and the
 * lifetime of the in-flight stream.
 *
 * The dispatch promise RTK hands back carries `.abort()`, which reaches
 * `thunkAPI.signal` and from there the fetch — so one ref is enough to power
 * both the Stop button and the unmount cleanup.
 */
export const useChat = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const { messages, conversationId, activeKey, loading, error, notFound, sending, clearing, lastAsk } = useSelector(
    (state) => state.chat
  );
  const documentId = useActiveDocumentId();
  const chatId = useActiveChatId();

  // The context is the URL's: one of the user's global chats, or one
  // document's chat. Neither (the new-chat screen) loads nothing — no chat
  // exists until the first question creates one.
  const context = useMemo(
    () => (chatId ? { chatId } : documentId ? { documentId } : null),
    [chatId, documentId]
  );
  const key = context ? contextKey(context) : null;

  // Selecting a different chat does not remount the page, so this has to key
  // off the context. An answer still streaming for the conversation being left
  // is NOT stopped: its events are filed under its own context, and coming
  // back shows it where it got to.
  const conversationRef = useRef(null);

  const loadConversation = useCallback(() => {
    conversationRef.current?.abort();
    if (!context) return null;

    const promise = dispatch(fetchConversation(context.chatId ? context : context.documentId));
    conversationRef.current = promise;
    return promise;
  }, [dispatch, context]);

  useEffect(() => {
    const promise = loadConversation();
    return () => promise?.abort();
  }, [loadConversation]);

  /** `target` is `{ chatId }` or `{ documentId }` — where the question goes. */
  const run = useCallback(
    (question, target) => {
      const streamKey = contextKey(target);
      streams.get(streamKey)?.abort();

      const promise = dispatch(askQuestion({ question, ...target }));
      streams.set(streamKey, promise);

      promise.finally(() => {
        // Only clear the entry if this stream is still the current one — a
        // newer stream may already have replaced it.
        if (streams.get(streamKey) === promise) streams.delete(streamKey);
        // A global chat's first question titles it, and every question moves
        // it to the top of the list — so the list is re-read once it settles.
        if (target.chatId) dispatch(fetchChats());
      });
    },
    [dispatch]
  );

  // Nothing may be sent until the conversation exists: the id is what threads
  // the question onto the right transcript server-side. `activeKey` must match
  // too — for one render after a context switch the store still holds the
  // previous context's conversation, and a queued question (header search)
  // would otherwise land on it.
  const ready = Boolean(conversationId) && activeKey === key && !loading && !clearing;

  const send = useCallback(
    (question) => {
      const trimmed = question.trim();
      if (!trimmed || sending || !ready) return;

      // The first question of a still-untitled chat names it, straight away.
      if (context.chatId && messages.length === 0) {
        const listed = store.getState().chats.list.find((item) => item.id === context.chatId);
        const title = chatTitleFromQuestion(trimmed);
        if (listed && title && isDefaultChatTitle(listed.title)) {
          dispatch(chatTitled({ id: context.chatId, title }));
          dispatch(renameChat({ id: context.chatId, title }));
        }
      }

      dispatch(askedQuestion(trimmed));
      run(trimmed, context);
    },
    [dispatch, store, context, messages.length, sending, ready, run]
  );

  /** Stop generating — the text received so far stays on screen. */
  const stop = useCallback(() => {
    streams.get(key)?.abort();
  }, [key]);

  /** Re-ask the last question, e.g. once a document finishes processing. */
  const retry = useCallback(() => {
    if (!lastAsk || sending || !ready) return;

    dispatch(droppedLastAnswer());
    run(lastAsk.question, lastAsk.chatId ? { chatId: lastAsk.chatId } : { documentId: lastAsk.documentId });
  }, [dispatch, lastAsk, sending, ready, run]);

  const reset = useCallback(() => {
    streams.forEach((stream) => stream.abort());
    streams.clear();
    dispatch(clearChat());
  }, [dispatch]);

  /**
   * Clears a document chat's messages and reloads it — the backend opens a
   * fresh one the moment the next `fetchConversation` asks for it. Global
   * chats are not cleared; they are deleted from the Chats module instead.
   *
   * Confirming with the user is the caller's job (`ConfirmDialog`, not a
   * native `window.confirm`) — this only runs once that has already happened.
   * Guarded against firing mid-answer or mid-clear so a double click cannot
   * fire two deletes.
   */
  const clear = useCallback(async () => {
    if (clearing || sending || !documentId) return false;

    streams.get(key)?.abort();
    conversationRef.current?.abort();
    const clearLoad = conversationRef.current;

    const result = await dispatch(deleteConversation(documentId));
    if (!deleteConversation.fulfilled.match(result)) return false;
    // A context switch supersedes this clear; its conversation load must survive.
    if (conversationRef.current !== clearLoad) return true;

    notify.success(result.payload?.message ?? 'Conversation cleared');
    loadConversation();
    return true;
  }, [dispatch, documentId, key, clearing, sending, loadConversation]);

  return {
    chatId,
    documentId,
    messages,
    loading,
    error,
    /** The open chat (or its document) is gone or no longer accessible. */
    notFound: Boolean(key) && activeKey === key && notFound,
    sending,
    clearing,
    ready,
    send,
    stop,
    retry,
    reload: loadConversation,
    clear,
    reset,
  };
};

export default useChat;
