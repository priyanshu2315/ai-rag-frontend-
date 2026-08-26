import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchDocuments, uploadDocument } from '../redux/actions/documentActions';
import { setActiveDocument } from '../redux/slices/documentSlice';
import { MAX_UPLOAD_BYTES } from '../constants/messages';
import { formatBytes } from '../utils/format';
import notify from '../utils/notify';

/**
 * Loads the document list once and keeps the active selection in sync.
 * The in-flight request is aborted on unmount (§6) so a slow response can
 * never write into an unmounted tree.
 */
export const useDocuments = () => {
  const dispatch = useDispatch();
  const { list, activeId, loading, uploading, error } = useSelector((state) => state.documents);

  useEffect(() => {
    const promise = dispatch(fetchDocuments());
    return () => promise.abort();
  }, [dispatch]);

  const selectDocument = useCallback((id) => dispatch(setActiveDocument(id)), [dispatch]);

  const upload = useCallback(
    async (file) => {
      if (!file) return false;
      if (file.size > MAX_UPLOAD_BYTES) {
        notify.error(`${file.name} is larger than ${formatBytes(MAX_UPLOAD_BYTES)}`);
        return false;
      }
      const result = await dispatch(uploadDocument(file));
      const ok = uploadDocument.fulfilled.match(result);
      if (ok) notify.uploaded(file.name);
      return ok;
    },
    [dispatch]
  );

  const activeDocument = list.find((doc) => doc.id === activeId) ?? null;

  return { documents: list, activeId, activeDocument, loading, uploading, error, selectDocument, upload };
};

export default useDocuments;
