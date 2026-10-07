import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { deleteDocument, fetchDocuments, uploadDocument } from '../redux/actions/documentActions';
import { clearDeleteError } from '../redux/slices/documentSlice';
import { canDeleteDocument } from '../constants/documentStatus';
import { MESSAGES } from '../constants/messages';
import { ROUTES, documentPath } from '../constants/routes';
import useActiveDocumentId from './useActiveDocumentId';
import notify from '../utils/notify';

/**
 * Loads the document list once and resolves whichever document the URL names.
 * The in-flight request is aborted on unmount (§6) so a slow response can
 * never write into an unmounted tree.
 */
export const useDocuments = () => {
  const dispatch = useDispatch();
  const store = useStore();
  const navigate = useNavigate();
  const { list, loaded, loading, uploading, error, deletingId, deleteError, deletedIds } = useSelector(
    (state) => state.documents
  );
  const activeId = useActiveDocumentId();

  useEffect(() => {
    const promise = dispatch(fetchDocuments());
    return () => promise.abort();
  }, [dispatch]);

  const activeDocument = list.find((doc) => doc.id === activeId) ?? null;

  // A bookmarked or refreshed URL can name a document that is gone, or that
  // was never this user's. Waiting for `loaded` matters: before the list
  // arrives every id looks unknown, and redirecting then would undo exactly
  // the refresh this route exists to support.
  useEffect(() => {
    if (!activeId) return;
    const wasDeleted = deletedIds.includes(activeId);
    if (!wasDeleted && (!loaded || activeDocument)) return;

    if (!wasDeleted) notify.info(MESSAGES.DOCUMENT_UNAVAILABLE);
    navigate(ROUTES.CHAT, { replace: true });
  }, [activeId, loaded, activeDocument, deletedIds, navigate]);

  /** Selecting a context is a navigation — `null` means all documents. */
  const selectDocument = useCallback((id) => navigate(documentPath(id)), [navigate]);

  const upload = useCallback(
    async (file) => {
      if (!file) return false;
      const result = await dispatch(uploadDocument(file));
      const ok = uploadDocument.fulfilled.match(result);
      if (ok) {
        notify.uploaded(file.name);
        dispatch(fetchDocuments());
        // The document page is where its processing progress is shown, so
        // land on it — connect as soon as the upload returns; early live events can be missed.
        if (result.payload?.id) navigate(documentPath(result.payload.id));
      }
      return ok;
    },
    [dispatch, navigate]
  );

  const resetDeleteError = useCallback(() => dispatch(clearDeleteError()), [dispatch]);

  const remove = useCallback(async (id) => {
    // Read current state so repeated clicks cannot start overlapping deletes.
    const current = store.getState().documents;
    const doc = current.list.find((item) => item.id === id);
    if (current.deletingId || !canDeleteDocument(doc)) return false;

    const result = await dispatch(deleteDocument(id));
    if (!deleteDocument.fulfilled.match(result)) return false;

    notify.deleted(doc.filename);
    // The route validation effect handles the current URL, even if the user
    // navigated while deletion was pending. Other document views stay open.
    return true;
  }, [dispatch, store]);

  return {
    documents: list, activeId, activeDocument, loading, uploading, error,
    deletingId, deleteError, selectDocument, upload, remove, resetDeleteError,
  };
};

export default useDocuments;
