import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchChildChunks, fetchParentChunks } from '../redux/actions/chunkActions';

/**
 * Owns the chunk explorer: the parent list for `documentId`, which rows are
 * open, and the lazily-fetched children behind each one.
 *
 * Expansion is component state rather than store state — it is a view detail
 * that nothing else reads, and putting it in the store would mean reasoning
 * about clearing it too.
 *
 * The refs mirror render values so `toggle` can read the current expansion and
 * cache without becoming a new function on every fetch — the rows are memoised
 * and a fresh callback would re-render all of them.
 */
export const useDocumentChunks = (documentId, ready = true) => {
  const dispatch = useDispatch();
  const { documentId: loadedDocumentId, parents, parentResponse, loading, error, children } =
    useSelector((state) => state.chunks);
  const currentDocument = loadedDocumentId === documentId;
  const visibleParents = currentDocument ? parents : [];
  const visibleChildren = currentDocument ? children : {};
  const [expanded, setExpanded] = useState(() => new Set());

  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const childrenRef = useRef(children);
  childrenRef.current = visibleChildren;

  // Every child request in flight, so all of them can be aborted on unmount
  // (§6) — a row can be expanded while an earlier one is still loading.
  const pendingRef = useRef(new Map());

  const trackChildRequest = useCallback(
    (parentId) => {
      pendingRef.current.get(parentId)?.abort();

      const promise = dispatch(fetchChildChunks(parentId));
      pendingRef.current.set(parentId, promise);
      promise.finally(() => {
        if (pendingRef.current.get(parentId) === promise) pendingRef.current.delete(parentId);
      });
    },
    [dispatch]
  );

  useEffect(() => {
    const pending = pendingRef.current;
    return () => {
      pending.forEach((promise) => promise.abort());
      pending.clear();
    };
  }, [documentId]);

  const load = useCallback(
    () => dispatch(fetchParentChunks(documentId)),
    [dispatch, documentId]
  );

  useEffect(() => {
    if (!documentId || !ready) return undefined;

    setExpanded(new Set());
    const promise = load();
    return () => promise.abort();
  }, [load, documentId, ready]);

  /** Open a row (fetching its children the first time) or close it again. */
  const toggle = useCallback(
    (parentId) => {
      const opening = !expandedRef.current.has(parentId);

      setExpanded((current) => {
        const next = new Set(current);
        if (opening) next.add(parentId);
        else next.delete(parentId);
        return next;
      });

      // Cached from a previous expansion — the spec's "do not refetch".
      if (opening && !childrenRef.current[parentId]) trackChildRequest(parentId);
    },
    [trackChildRequest]
  );

  const retryChildren = useCallback(
    (parentId) => trackChildRequest(parentId),
    [trackChildRequest]
  );

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  return {
    parents: visibleParents,
    parentResponse: currentDocument ? parentResponse : null,
    loading: currentDocument ? loading : ready,
    error: currentDocument ? error : null,
    children: visibleChildren,
    expanded, toggle, collapseAll, retryChildren, reload: load,
  };
};

export default useDocumentChunks;
