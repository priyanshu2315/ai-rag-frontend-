import { useEffect, useRef } from 'react';
import { BrainCircuit, X } from 'lucide-react';
import DocumentDropzone from '../documents/DocumentDropzone';
import DocumentList from '../documents/DocumentList';
import ErrorState from '../feedback/ErrorState';
import cn from '../../utils/cn';

/** Brand, upload, and document context picker for desktop and the mobile drawer. */
const Sidebar = ({ documents, activeId, loading, uploading, error, onSelect, onUpload, onClose, mobile = false, className }) => {
  const sidebarRef = useRef(null);

  useEffect(() => {
    if (!mobile) return undefined;
    const previousFocus = document.activeElement;
    sidebarRef.current?.querySelector('button')?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const buttons = [...sidebarRef.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobile, onClose]);

  return (
    <aside
      ref={sidebarRef}
      role={mobile ? 'dialog' : undefined}
      aria-modal={mobile || undefined}
      aria-label="Documents"
      className={cn(
        'flex h-dvh w-(--sidebar-w) shrink-0 flex-col border-r border-border bg-surface',
        mobile && 'absolute inset-y-0 left-0 w-[min(20rem,calc(100vw-3rem))] shadow-(--sh-lg)',
        className
      )}
    >
      <div className="flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-border px-4">
        <BrainCircuit className="h-5 w-5 text-blue" />
        <span className="font-display text-[15px] font-semibold text-ink">DocuMind</span>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close documents"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-(--radius-sm) text-muted hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        )}
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
};

export default Sidebar;
