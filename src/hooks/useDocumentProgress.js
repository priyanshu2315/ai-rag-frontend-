import { useEffect, useReducer, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { fetchDocuments } from '../redux/actions/documentActions';
import { documentStatusChanged } from '../redux/slices/documentSlice';
import { watchProgress } from '../services/progressStream';
import { createInitialProgress, progressReducer } from '../utils/progressReducer';
import { DOCUMENT_STATUS, isProcessing } from '../constants/documentStatus';
import { MESSAGES } from '../constants/messages';
import notify from '../utils/notify';

/** Pause before the one reconnect, so a blip isn't retried into the same blip. */
const RECONNECT_DELAY_MS = 1000;
/** How often `my-documents` is checked once the stream is given up on. */
const POLL_INTERVAL_MS = 3000;

/** Resolves after `ms`, or immediately if `signal` aborts first. */
const wait = (ms, signal) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });

/**
 * Opens the progress stream for `doc` while — and only while — its status
 * is PROCESSING, and keeps the live tree in component state (it is transient
 * and nothing else reads it).
 *
 * The document's status is the trigger, and the store is where the outcome goes:
 * `completed` / `failed` are written back to the document list, which is what
 * unlocks (or keeps locked) the chat composer.
 *
 * Connection policy, per the backend contract (live only, no replay):
 *   1. open the stream;
 *   2. if it drops or fails retryably, reconnect once — the tree is then partial;
 *   3. if that fails too, poll `my-documents` until the status changes.
 *
 * Everything is tied to one AbortController, so leaving the page, or the status
 * leaving PROCESSING, cancels the fetch, the timers and any poll in flight.
 */
export const useDocumentProgress = (doc) => {
  const dispatch = useDispatch();
  const [progress, update] = useReducer(progressReducer, undefined, createInitialProgress);

  const { id, filename, fresh } = doc;
  const processing = isProcessing(doc);

  // Read at effect time, but not dependencies: the effect must restart when
  // the document or its status changes, not when a refetch swaps these.
  const latest = useRef({ filename, fresh });
  latest.current = { filename, fresh };

  useEffect(() => {
    if (!id || !processing) return undefined;

    const controller = new AbortController();
    const { signal } = controller;

    update({ type: 'reset', reconnected: !latest.current.fresh });

    const handleEvent = (event) => {
      if (signal.aborted) return;
      update({ type: 'event', event });

      if (event.type === 'completed') {
        dispatch(documentStatusChanged({ id, status: DOCUMENT_STATUS.COMPLETED }));
        notify.ready(latest.current.filename);
      } else if (event.type === 'failed') {
        dispatch(documentStatusChanged({ id, status: DOCUMENT_STATUS.FAILED }));
      }
    };

    // Last resort. The list is refetched into the store, so the effect ends by
    // itself the moment this document's status flips.
    const poll = async () => {
      update({ type: 'polling' });

      while (!signal.aborted) {
        // eslint-disable-next-line no-await-in-loop
        await wait(POLL_INTERVAL_MS, signal);
        if (signal.aborted) return;

        const request = dispatch(fetchDocuments());
        signal.addEventListener('abort', () => request.abort(), { once: true });
        // eslint-disable-next-line no-await-in-loop
        const result = await request;
        if (signal.aborted) return;

        // The failure has already been toasted by the axios layer; stop rather
        // than repeat it every few seconds.
        if (!fetchDocuments.fulfilled.match(result)) {
          update({ type: 'error', message: MESSAGES.PROGRESS_LOST });
          return;
        }
      }
    };

    const run = async () => {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (attempt > 0) {
          update({ type: 'reconnecting' });
          // eslint-disable-next-line no-await-in-loop
          await wait(RECONNECT_DELAY_MS, signal);
        }

        // eslint-disable-next-line no-await-in-loop
        const result = await watchProgress(id, { signal, onEvent: handleEvent });
        if (signal.aborted || result.done) return;

        // 404 and the like: opening it again cannot help, and polling would
        // only be told the same thing.
        if (!result.retryable) {
          update({ type: 'error', message: result.error });
          return;
        }
      }

      await poll();
    };

    run();
    return () => controller.abort();
  }, [id, processing, dispatch]);

  return progress;
};

export default useDocumentProgress;
