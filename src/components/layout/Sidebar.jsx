import { BrainCircuit } from 'lucide-react';
import DocumentDropzone from '../documents/DocumentDropzone';
import DocumentList from '../documents/DocumentList';
import ErrorState from '../feedback/ErrorState';

/** 248px sidebar (§4): brand, upload, then the document context picker. */
const Sidebar = ({ documents, activeId, loading, uploading, error, onSelect, onUpload }) => (
  <aside className="flex h-screen w-(--sidebar-w) shrink-0 flex-col border-r border-border bg-surface">
    <div className="flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-border px-4">
      <BrainCircuit className="h-5 w-5 text-blue" />
      <span className="font-display text-[15px] font-semibold text-ink">DocuMind</span>
    </div>

    <div className="border-b border-border p-3">
      <DocumentDropzone onUpload={onUpload} uploading={uploading} />
    </div>

    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
        Context
      </p>

      {error ? (
        <ErrorState message={error} />
      ) : (
        <DocumentList
          documents={documents}
          activeId={activeId}
          loading={loading}
          onSelect={onSelect}
        />
      )}
    </div>
  </aside>
);

export default Sidebar;
