import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { askQuestion, deleteConversation, fetchConversation } from '../redux/actions/chatActions';
import { askedQuestion, clearChat, droppedLastAnswer } from '../redux/slices/chatSlice';
import useActiveDocumentId from './useActiveDocumentId';
import notify from '../utils/notify';

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
  const { messages, conversationId, loading, error, sending, clearing, lastAsk } = useSelector(
    (state) => state.chat
  );
  const documentId = useActiveDocumentId();

  const streamRef = useRef(null);

  // Abort on unmount. StrictMode mounts, unmounts and remounts in dev, so
  // without this a stream started on the first mount would keep a reader open
  // and go on dispatching into a tree that is gone.
  useEffect(
    () => () => {
      streamRef.current?.abort();
      streamRef.current = null;
    },
    []
  );

  // Load the conversation for whichever context is selected — a document, or
  // all of them when `documentId` is null. Selecting a different document does
  // not remount the page, so this has to key off the id, and any answer still
  // streaming belongs to the conversation being left: it is stopped rather
  // than allowed to land in the next one's transcript.
  const conversationRef = useRef(null);

  const loadConversation = useCallback(() => {
    conversationRef.current?.abort();

    const promise = dispatch(fetchConversation(documentId));
    conversationRef.current = promise;
    return promise;
  }, [dispatch, documentId]);

  useEffect(() => {
    streamRef.current?.abort();
    streamRef.current = null;

    const promise = loadConversation();
    return () => promise.abort();
  }, [loadConversation]);

  const run = useCallback(
    (question, docId) => {
      streamRef.current?.abort();

      const promise = dispatch(askQuestion({ question, documentId: docId }));
      streamRef.current = promise;

      // Only clear the ref if this stream is still the current one — a newer
      // stream may already have replaced it.
      promise.finally(() => {
        if (streamRef.current === promise) streamRef.current = null;
      });
    },
    [dispatch]
  );

  // Nothing may be sent until the conversation exists: the id is what threads
  // the question onto the right transcript server-side.
  const ready = Boolean(conversationId) && !loading;

  const send = useCallback(
    (question) => {
      const trimmed = question.trim();
      if (!trimmed || sending || !ready) return;

      dispatch(askedQuestion(trimmed));
      run(trimmed, documentId);
    },
    [dispatch, documentId, sending, ready, run]
  );

  /** Stop generating — the text received so far stays on screen. */
  const stop = useCallback(() => {
    streamRef.current?.abort();
  }, []);

  /** Re-ask the last question, e.g. once a document finishes processing. */
  const retry = useCallback(() => {
    if (!lastAsk || sending || !ready) return;

    dispatch(droppedLastAnswer());
    run(lastAsk.question, lastAsk.documentId);
  }, [dispatch, lastAsk, sending, ready, run]);

  const reset = useCallback(() => {
    streamRef.current?.abort();
    dispatch(clearChat());
  }, [dispatch]);

  /**
   * Deletes the conversation on the server and reloads it — the backend opens
   * a fresh one the moment the next `fetchConversation` asks for it, so this
   * reuses `loadConversation` rather than shaping a "new" state by hand.
   *
   * Confirming with the user is the caller's job (`ConfirmDialog`, not a
   * native `window.confirm`) — this only runs once that has already happened.
   * Guarded against firing mid-answer or mid-clear so a double click cannot
   * fire two deletes.
   */
  const clear = useCallback(async () => {
    if (clearing || sending) return false;

    streamRef.current?.abort();
    conversationRef.current?.abort();

    const result = await dispatch(deleteConversation(documentId));
    if (!deleteConversation.fulfilled.match(result)) return false;

    notify.success(result.payload?.message ?? 'Conversation cleared');
    loadConversation();
    return true;
  }, [dispatch, documentId, clearing, sending, loadConversation]);

  return {
    messages,
    loading,
    error,
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
