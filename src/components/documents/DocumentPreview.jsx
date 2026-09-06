import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, FileQuestion, X } from 'lucide-react';
import Button from '../buttons/Button';

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];

/**
 * How a file can be shown, from its name — the list endpoint sends no mime
 * type, and the extension is what the browser goes on anyway.
 */
const previewKind = (filename = '') => {
  const extension = filename.split('.').pop()?.toLowerCase();

  if (extension === 'pdf' || extension === 'txt' || extension === 'md') return 'frame';
  if (IMAGE_TYPES.includes(extension)) return 'image';

  // Word documents and anything else: no browser renders them inline, so the
  // honest thing is to hand the file over rather than show an empty frame.
  return 'unsupported';
};

/**
 * The uploaded file itself, over the chat.
 *
 * A modal rather than a side panel: the shell is a fixed three-column layout
 * with its own overflow, and a document is worth the full width while it is
 * being read. It portals to the body for the same reason — every ancestor
 * inside the shell clips.
 *
 * The prop is `file`, not `document`, so the global `document` stays reachable
 * inside this component.
 */
const DocumentPreview = ({ file, onClose }) => {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const kind = previewKind(file.filename);

  return createPortal(
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4 backdrop-blur-[2px]"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={file.filename}
        onClick={(event) => event.stopPropagation()}
        className="flex h-full max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-(--radius-lg) border border-border bg-surface shadow-(--sh-lg)"
      >
        <header className="flex h-(--topbar-h) shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <h2 className="truncate font-display text-[14px] font-semibold text-ink" title={file.filename}>
            {file.filename}
          </h2>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(file.fileUrl, '_blank', 'noopener,noreferrer')}
              title="Open in a new tab"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Open in a new tab</span>
            </Button>

            <Button variant="ghost" size="icon" onClick={onClose} title="Close preview">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-surface-2">
          {kind === 'frame' && (
            <iframe
              src={file.fileUrl}
              title={file.filename}
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-surface"
            />
          )}

          {kind === 'image' && (
            <div className="flex h-full items-center justify-center p-4">
              <img
                src={file.fileUrl}
                alt={file.filename}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}

          {kind === 'unsupported' && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-full bg-blue-lt p-4">
                <FileQuestion className="h-7 w-7 text-blue" />
              </div>
              <p className="font-display text-base font-semibold text-ink">
                This file cannot be shown here
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                Browsers only render PDFs, text and images inline. The assistant has already read
                this one — open it in a new tab to see it yourself.
              </p>
              <Button
                className="mt-5"
                onClick={() => window.open(file.fileUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />
                Open in a new tab
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DocumentPreview;
