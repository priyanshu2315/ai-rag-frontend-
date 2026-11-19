import { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchDocuments } from '../redux/actions/documentActions';
import { replaceFinished, replaceProgressChanged } from '../redux/slices/documentSlice';
import { watchProgress } from '../services/progressStream';
import { MESSAGES } from '../constants/messages';
import { changesPath } from '../constants/routes';
import { isReplaceTerminal, liveText } from '../utils/documentVersion';
import notify from '../utils/notify';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 1000;

const wait = (ms, signal) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => {
    clearTimeout(timer);
    resolve();
  }, { once: true });
});

/**
 * Follows one document's replace run on `GET /documents/progress/:id` until
 * `replace_complete` or `replace_failed`, then refreshes the list (new
 * `version`, `filename`, `updatedAt`) and says how it went.
 *
 * Mounted by the shell, so it keeps going while the admin moves between
 * pages. If the stream drops, the list is refetched first: a `version` that
 * already moved past the old one means the switch happened while we were not
 * listening, and there is nothing left to wait for.
 */
export const useReplaceProgress = (id, expectedVersion) => {
  const dispatch = useDispatch();
  // A ref, not a dependency: `replace_start` can fill the version in mid-run
  // (after a 409 we start without one), and that must not reopen the stream.
  const versionRef = useRef(expectedVersion);
  versionRef.current = expectedVersion;
  const navigate = useNavigate();
  // Read at completion time, not when the run started: the admin may have
  // moved on since.
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    if (!id) return undefined;
    const controller = new AbortController();
    const { signal } = controller;
    let outcome = null;

    const onEvent = (event) => {
      if (signal.aborted) return;
      dispatch(replaceProgressChanged({ id, event }));
      if (isReplaceTerminal(event)) outcome = event;
    };

    const finish = (report) => {
      dispatch(fetchDocuments());
      dispatch(replaceFinished(id));
      report();
    };

    /**
     * Live: on this document's pages, go straight to what changed; anywhere
     * else, say so with a link instead of pulling the admin away.
     */
    const live = (event) => {
      const target = changesPath(id, event.version);
      const onDocument = pathRef.current.startsWith(`/documents/${id}`);
      finish(() => {
        if (onDocument) {
          navigate(target);
          notify.replaceLive(liveText(event));
        } else {
          notify.replaceLive(liveText(event), { label: 'See what changed', onClick: () => navigate(target) });
        }
      });
    };

    const run = async () => {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
        if (attempt > 0) {
          const request = dispatch(fetchDocuments());
          signal.addEventListener('abort', () => request.abort(), { once: true });
          // eslint-disable-next-line no-await-in-loop
          const fetched = await request;
          if (signal.aborted) return;
          const doc = fetchDocuments.fulfilled.match(fetched)
            ? fetched.payload?.find((item) => item.id === id) : undefined;
          if (fetchDocuments.fulfilled.match(fetched) && !doc) {
            // Deleted, or no longer this account's — nothing to follow.
            dispatch(replaceFinished(id));
            return;
          }
          if (doc && versionRef.current && Number(doc.version) >= versionRef.current) {
            live({ version: doc.version });
            return;
          }
          // eslint-disable-next-line no-await-in-loop
          await wait(Math.min(RETRY_DELAY_MS * 2 ** (attempt - 1), 15000), signal);
          if (signal.aborted) return;
        }

        // eslint-disable-next-line no-await-in-loop
        const result = await watchProgress(id, { signal, onEvent, isTerminal: isReplaceTerminal });
        if (signal.aborted || result.aborted) return;

        if (outcome?.type === 'replace_complete') {
          live(outcome);
          return;
        }
        if (outcome?.type === 'replace_failed') {
          finish(() => notify.replaceFailed(MESSAGES.REPLACE_FAILED));
          return;
        }
        if (result.error && !result.retryable) break;
      }
      finish(() => notify.info(MESSAGES.REPLACE_LOST));
    };

    run();
    return () => controller.abort();
  }, [id, dispatch, navigate]);
};

export default useReplaceProgress;
