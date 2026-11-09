import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ConfirmDialog from '../feedback/ConfirmDialog';
import { canDeleteDocument, needsProgress } from '../../constants/documentStatus';
import useDocuments from '../../hooks/useDocuments';
import useDocumentProgress from '../../hooks/useDocumentProgress';

const ProgressWatcher = ({ document: doc }) => {
  useDocumentProgress(doc);
  return null;
};

/**
 * The signed-in frame (§4): module sidebar, global header, and the content
 * area every module renders into.
 *
 * It owns the document list because several modules read it (knowledge base,
 * document chat, chunk explorer, upload) — they get it through the outlet
 * context rather than each fetching a copy.
 */
const AppShell = () => {
  const {
    documents, activeId, activeDocument, loading, loaded, uploading, error, reload, upload,
    deletingId, deleteError, remove, resetDeleteError,
  } = useDocuments();
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  // Every drawer link closes it on click; growing past the breakpoint does too.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const desktop = window.matchMedia('(min-width: 64rem)');
    desktop.addEventListener('change', closeMenu);
    return () => desktop.removeEventListener('change', closeMenu);
  }, [menuOpen, closeMenu]);

  const requestDelete = useCallback((doc) => {
    resetDeleteError();
    setDeleteTarget(doc);
  }, [resetDeleteError]);

  const confirmDelete = async () => {
    if (deleteTarget && (await remove(deleteTarget.id))) setDeleteTarget(null);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      {documents.filter((doc) => doc.id === activeId && needsProgress(doc)).map((doc) => (
        <ProgressWatcher key={doc.id} document={doc} />
      ))}

      <Sidebar className="hidden lg:flex" />

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 w-full bg-scrim/60"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <Sidebar mobile onClose={closeMenu} />
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this document?"
          message={`Delete “${deleteTarget.filename}” from the library for everyone, with its summary, chunks and document chats? This can't be undone. Global chats remain.`}
          confirmLabel="Delete document"
          loading={Boolean(deletingId)}
          confirmDisabled={!canDeleteDocument(documents.find((doc) => doc.id === deleteTarget.id))}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col">
          <Outlet context={{
            activeDocument, documents, documentsLoading: loading, documentsLoaded: loaded,
            documentsError: error, reloadDocuments: reload,
            upload, uploading, requestDelete, deletingId,
          }} />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
