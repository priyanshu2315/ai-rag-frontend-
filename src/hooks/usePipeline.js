import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { fetchPipeline } from '../redux/actions/pipelineActions';

/**
 * The engineering timeline, fetched once per session.
 *
 * The cache check reads the store at effect time rather than depending on
 * `status`: with `status` in the deps, its own `idle → loading` change would
 * re-run the effect and the cleanup would abort the request it just made.
 * Requests in flight abort on unmount (§6), retries included.
 */
export const usePipeline = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const { phases, total, status, error } = useSelector((state) => state.pipeline);
  const retryRef = useRef(null);

  useEffect(() => {
    if (store.getState().pipeline.status === 'succeeded') return undefined;
    const promise = dispatch(fetchPipeline());
    return () => {
      promise.abort();
      retryRef.current?.abort();
    };
  }, [dispatch, store]);

  const retry = useCallback(() => {
    retryRef.current?.abort();
    retryRef.current = dispatch(fetchPipeline());
  }, [dispatch]);

  return { phases, total, status, error, retry };
};

export default usePipeline;
