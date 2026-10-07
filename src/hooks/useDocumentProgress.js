import { useEffect } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { fetchDocuments } from '../redux/actions/documentActions';
import { documentProgressChanged } from '../redux/slices/documentSlice';
import { watchProgress } from '../services/progressStream';
import { needsProgress } from '../constants/documentStatus';
import { MESSAGES } from '../constants/messages';
import notify from '../utils/notify';

const RECONNECT_DELAY_MS = 1000;

const wait = (ms, signal) => new Promise((resolve) => {
  const onAbort = () => {
    clearTimeout(timer);
    resolve();
  };
  const timer = setTimeout(() => {
    signal.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  signal.addEventListener('abort', onAbort, { once: true });
  if (signal.aborted) onAbort();
});

/** One authenticated stream per unfinished document, including its summary stage. */
export const useDocumentProgress = (doc) => {
  const dispatch = useDispatch();
  const store = useStore();
  const { id, filename, fresh } = doc;
  const unfinished = needsProgress(doc);

  useEffect(() => {
    if (!id || !unfinished) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    const update = (progressAction) => dispatch(documentProgressChanged({ id, progressAction }));
    let notified = false;

    update({ type: 'connected', reconnected: !fresh });

    const onEvent = (event) => {
      if (signal.aborted) return;
      const shouldNotify = event.type === 'chunks_ready' && fresh && !notified &&
        store.getState().documents.list.some((item) =>
          item.id === id && item.status === 'PROCESSING');
      update({ type: 'event', event });
      if (shouldNotify) {
        notified = true;
        notify.ready(filename);
      }
    };

    const run = async () => {
      let attempt = 0;
      while (!signal.aborted) {
        if (attempt > 0) {
          update({ type: 'reconnecting' });
          // Refetch first: the worker may have finished while the stream was down.
          const request = dispatch(fetchDocuments());
          const abortRequest = () => request.abort();
          signal.addEventListener('abort', abortRequest, { once: true });
          // eslint-disable-next-line no-await-in-loop
          const fetched = await request;
          signal.removeEventListener('abort', abortRequest);
          if (signal.aborted) return;
          if (fetchDocuments.fulfilled.match(fetched)) {
            const current = fetched.payload?.find((item) => item.id === id);
            if (!needsProgress(current)) return;
          }
          // eslint-disable-next-line no-await-in-loop
          await wait(Math.min(RECONNECT_DELAY_MS * 2 ** (attempt - 1), 30000), signal);
        }
        if (signal.aborted) return;
        // eslint-disable-next-line no-await-in-loop
        const result = await watchProgress(id, { signal, onEvent });
        if (signal.aborted || result.done || result.aborted) return;
        if (!result.retryable) {
          update({ type: 'error', message: result.error ?? MESSAGES.PROGRESS_LOST });
          return;
        }
        attempt += 1;
        if (attempt > 5) {
          update({ type: 'error', message: 'Live connection unavailable after five retries. Saved chunks and document statuses remain available; reopen the document to retry.' });
          return;
        }
      }
    };

    run();
    return () => controller.abort();
  }, [id, unfinished, filename, fresh, dispatch, store]);
};

export default useDocumentProgress;
