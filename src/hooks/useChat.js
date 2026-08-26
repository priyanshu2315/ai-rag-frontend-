import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { askQuestion } from '../redux/actions/chatActions';
import { askedQuestion, clearChat, droppedLastAnswer } from '../redux/slices/chatSlice';

/**
 * Owns the send sequence and the lifetime of the in-flight stream.
 *
 * The dispatch promise RTK hands back carries `.abort()`, which reaches
 * `thunkAPI.signal` and from there the fetch — so one ref is enough to power
 * both the Stop button and the unmount cleanup.
 */
export const useChat = () => {
  const dispatch = useDispatch();
  const { messages, sending, lastAsk } = useSelector((state) => state.chat);
  const documentId = useSelector((state) => state.documents.activeId);

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

  const send = useCallback(
    (question) => {
      const trimmed = question.trim();
      if (!trimmed || sending) return;

      dispatch(askedQuestion(trimmed));
      run(trimmed, documentId);
    },
    [dispatch, documentId, sending, run]
  );

  /** Stop generating — the text received so far stays on screen. */
  const stop = useCallback(() => {
    streamRef.current?.abort();
  }, []);

  /** Re-ask the last question, e.g. once a document finishes processing. */
  const retry = useCallback(() => {
    if (!lastAsk || sending) return;

    dispatch(droppedLastAnswer());
    run(lastAsk.question, lastAsk.documentId);
  }, [dispatch, lastAsk, sending, run]);

  const reset = useCallback(() => {
    streamRef.current?.abort();
    dispatch(clearChat());
  }, [dispatch]);

  return { messages, sending, send, stop, retry, reset };
};

export default useChat;
