import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { fetchDocumentChanges } from '../redux/actions/documentActions';

/**
 * The What changed page: which version the URL asks for, the changes for it,
 * and a way to pick another.
 *
 * Without `?version=` the backend answers for the latest version, and that
 * version is then written into the URL (replacing history, not adding to it)
 * so a refresh or a shared link shows the same thing. That write must not
 * fetch again, so a response already in the store for the same document and
 * version counts as loaded.
 */
export const useDocumentChanges = (documentId) => {
  const dispatch = useDispatch();
  const [params, setParams] = useSearchParams();
  const requested = params.get('version'); // a string, or null for "latest"
  const { request, data, loading, error } = useSelector((state) => state.changes);

  const forThisDocument = request?.documentId === documentId;
  const matches = forThisDocument && data && (requested === null || String(data.version) === requested);

  const load = useCallback(
    () => dispatch(fetchDocumentChanges({ documentId, version: requested })),
    [dispatch, documentId, requested]
  );

  useEffect(() => {
    if (!documentId || matches) return undefined;
    const promise = load();
    return () => promise.abort();
    // `matches` is left out on purpose: it turns true when this very request
    // lands, and re-running then would only abort a finished promise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, documentId]);

  // Latest was shown: pin it in the URL.
  useEffect(() => {
    if (requested !== null || !forThisDocument || !data?.version) return;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('version', String(data.version));
      return next;
    }, { replace: true });
  }, [requested, forThisDocument, data, setParams]);

  const selectVersion = useCallback((version) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.set('version', String(version));
      return next;
    });
  }, [setParams]);

  return {
    data: matches ? data : null,
    loading: !matches && (loading || !forThisDocument),
    error: forThisDocument && !loading ? error : null,
    requested,
    selectVersion,
    reload: load,
  };
};

export default useDocumentChanges;
