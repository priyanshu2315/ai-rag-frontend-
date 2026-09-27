import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import useDocuments from '../../hooks/useDocuments';

/**
 * The signed-in frame (§4). It owns the document list because both the
 * sidebar and the chat header read from it — the page below gets it back
 * through the outlet context rather than fetching a second time.
 */
const AppShell = () => {
  const { documents, activeId, activeDocument, loading, uploading, error, selectDocument, upload } =
    useDocuments();

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

      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet context={{ activeDocument, documents, upload, uploading }} />
      </div>
    </div>
  );
};

export default AppShell;
