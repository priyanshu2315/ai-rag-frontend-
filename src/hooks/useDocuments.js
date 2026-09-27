import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchDocuments, uploadDocument } from '../redux/actions/documentActions';
import { MAX_UPLOAD_BYTES, MESSAGES } from '../constants/messages';
import { ROUTES, documentPath } from '../constants/routes';
import useActiveDocumentId from './useActiveDocumentId';
import { formatBytes } from '../utils/format';
import notify from '../utils/notify';

/**
 * Loads the document list once and resolves whichever document the URL names.
 * The in-flight request is aborted on unmount (§6) so a slow response can
 * never write into an unmounted tree.
 */
export const useDocuments = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { list, loaded, loading, uploading, error } = useSelector((state) => state.documents);
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
    if (!activeId || !loaded || activeDocument) return;

    notify.info(MESSAGES.DOCUMENT_UNAVAILABLE);
    navigate(ROUTES.CHAT, { replace: true });
  }, [activeId, loaded, activeDocument, navigate]);

  /** Selecting a context is a navigation — `null` means all documents. */
  const selectDocument = useCallback((id) => navigate(documentPath(id)), [navigate]);

  const upload = useCallback(
    async (file) => {
      if (!file) return false;
      if (file.size > MAX_UPLOAD_BYTES) {
        notify.error(`${file.name} is larger than ${formatBytes(MAX_UPLOAD_BYTES)}`);
        return false;
      }
      const result = await dispatch(uploadDocument(file));
      const ok = uploadDocument.fulfilled.match(result);
      if (ok) {
        notify.uploaded(file.name);
        // The document page is where its processing progress is shown, so
        // land on it — with the stream opened from the start, the tree is whole.
        if (result.payload?.id) navigate(documentPath(result.payload.id));
      }
      return ok;
    },
    [dispatch, navigate]
  );

  return { documents: list, activeId, activeDocument, loading, uploading, error, selectDocument, upload };
};

export default useDocuments;
