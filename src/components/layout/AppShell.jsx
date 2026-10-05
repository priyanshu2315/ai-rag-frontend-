import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ConfirmDialog from '../feedback/ConfirmDialog';
import { canDeleteDocument } from '../../constants/documentStatus';
import useDocuments from '../../hooks/useDocuments';
import useDocumentProgress from '../../hooks/useDocumentProgress';
import { needsProgress } from '../../constants/documentStatus';

const ProgressWatcher = ({ document: doc }) => {
  useDocumentProgress(doc);
  return null;
};

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
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const openDocuments = useCallback(() => setDocumentsOpen(true), []);
  const closeDocuments = useCallback(() => setDocumentsOpen(false), []);

  useEffect(() => {
    if (!documentsOpen) return undefined;
    const desktop = window.matchMedia('(min-width: 64rem)');
    desktop.addEventListener('change', closeDocuments);
    return () => desktop.removeEventListener('change', closeDocuments);
  }, [documentsOpen, closeDocuments]);

  const requestDelete = useCallback((doc) => {
    resetDeleteError();
    setDeleteTarget(doc);
  }, [resetDeleteError]);

  const confirmDelete = async () => {
    if (deleteTarget && (await remove(deleteTarget.id))) setDeleteTarget(null);
  };

  const selectFromDrawer = (id) => {
    closeDocuments();
    selectDocument(id);
  };

  const uploadFromDrawer = (file) => {
    closeDocuments();
    return upload(file);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {documents.filter(needsProgress).map((doc) => (
        <ProgressWatcher key={doc.id} document={doc} />
      ))}
      <Sidebar
        className="hidden lg:flex"
        documents={documents}
        activeId={activeId}
        loading={loading}
        uploading={uploading}
        error={error}
        onSelect={selectDocument}
        onUpload={upload}
      />

      {documentsOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 w-full bg-scrim/60"
            aria-label="Close documents"
            onClick={closeDocuments}
          />
          <Sidebar
            mobile
            documents={documents}
            activeId={activeId}
            loading={loading}
            uploading={uploading}
            error={error}
            onSelect={selectFromDrawer}
            onUpload={uploadFromDrawer}
            onClose={closeDocuments}
          />
        </div>
      )}

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
        <Outlet context={{
          activeDocument, documents, upload, uploading, requestDelete, deletingId,
          openDocuments,
        }} />
      </div>
    </div>
  );
};

export default AppShell;
