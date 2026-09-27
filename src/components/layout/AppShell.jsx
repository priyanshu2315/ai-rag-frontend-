import { useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ConfirmDialog from '../feedback/ConfirmDialog';
import { canDeleteDocument } from '../../constants/documentStatus';
import useDocuments from '../../hooks/useDocuments';

/**
 * The signed-in frame (§4). It owns the document list because both the
 * sidebar and the chat header read from it — the page below gets it back
 * through the outlet context rather than fetching a second time.
 */
const AppShell = () => {
  const {
    documents, activeId, activeDocument, loading, uploading, error, selectDocument, upload,
    deletingId, deleteError, remove, resetDeleteError,
  } = useDocuments();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const requestDelete = useCallback((doc) => {
    resetDeleteError();
    setDeleteTarget(doc);
  }, [resetDeleteError]);

  const confirmDelete = async () => {
    if (deleteTarget && (await remove(deleteTarget.id))) setDeleteTarget(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        documents={documents}
        activeId={activeId}
        loading={loading}
        uploading={uploading}
        error={error}
        onSelect={selectDocument}
        onUpload={upload}
      />

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this document?"
          message={`Delete “${deleteTarget.filename}” and its summary, chunks, and document-specific conversations? This can't be undone. Conversations across all documents will remain.`}
          confirmLabel="Delete document"
          loading={Boolean(deletingId)}
          confirmDisabled={!canDeleteDocument(documents.find((doc) => doc.id === deleteTarget.id))}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet context={{ activeDocument, documents, upload, uploading, requestDelete, deletingId }} />
      </div>
    </div>
  );
};

export default AppShell;
