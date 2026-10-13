import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, FileQuestion, X } from 'lucide-react';
import Button from '../buttons/Button';
import Spinner from '../feedback/Spinner';
import ErrorState from '../feedback/ErrorState';
import { pdfPageUrl, safeFileUrl, validOffsetRange } from '../../utils/chatSources';
import DocumentOutline from './DocumentOutline';

const PdfCitationPreview = lazy(() => import('./PdfCitationPreview'));

const IMAGE_TYPES = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];

/**
 * How a file can be shown, from its name — the list endpoint sends no mime
 * type, and the extension is what the browser goes on anyway.
 */
export const previewKind = (filename = '', fileUrl) => {
  let extension = filename.split('.').pop()?.toLowerCase();
  if (!['pdf', 'txt', 'md', 'markdown', 'docx', ...IMAGE_TYPES].includes(extension) && safeFileUrl(fileUrl)) {
    extension = new URL(fileUrl).pathname.split('.').pop()?.toLowerCase();
  }

  if (['pdf', 'txt', 'md', 'markdown'].includes(extension)) return 'frame';
  if (IMAGE_TYPES.includes(extension)) return 'image';
  // No browser renders .docx inline, so it is drawn client-side instead —
  // the file never leaves the browser to do it.
  if (extension === 'docx') return 'docx';

  // Anything else: no browser renders it inline, and no in-browser renderer
  // exists here either, so the honest thing is to hand the file over rather
  // than show an empty frame.
  return 'unsupported';
};

/**
 * A .docx rendered client-side with `docx-preview` — the file is fetched as a
 * blob and drawn straight into `container`, so it never goes anywhere but this
 * tab. `renderAsync` mutates the node directly rather than returning markup,
 * which is why this owns a ref instead of returning JSX for the pages.
 *
 * The library itself is dynamically imported: every other kind of preview is
 * built from elements the browser already has, and loading a ~100KB renderer
 * for every chat visit just in case someone opens a .docx would be a poor
 * trade for the (probably) rare visit that does.
 */
const DocxPreview = ({ url, filename }) => {
  const [container, setContainer] = useState(null);
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!container) return undefined;

    const controller = new AbortController();
    setStatus('loading');
    container.replaceChildren();

    Promise.all([
      import('docx-preview'),
      fetch(url, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.blob();
      }),
    ])
      .then(([{ renderAsync }, blob]) =>
        renderAsync(blob, container, undefined, { inWrapper: true, ignoreFonts: true })
      )
      .then(() => {
        if (!controller.signal.aborted) setStatus('ready');
      })
      .catch((error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        setStatus('error');
      });

    return () => controller.abort();
  }, [container, url, attempt]);

  return (
    <div className="relative h-full overflow-auto p-6">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted">
          <Spinner />
          Rendering {filename}…
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ErrorState message="Couldn't render this document." onRetry={() => setAttempt((n) => n + 1)} />
        </div>
      )}

      {/* Always mounted — `renderAsync` needs the node to draw into, even
          while a retry is loading over it. */}
      <div ref={setContainer} className={status === 'ready' ? undefined : 'invisible'} />
    </div>
  );
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
export const SourceSelection = ({ selection }) => <aside className="max-h-[35vh] shrink-0 overflow-auto border-b border-border bg-surface p-4 sm:max-h-none sm:w-72 sm:border-b-0 sm:border-l" aria-label="Selected source passage">
  {selection.referenceNotice && <p className="mb-2 text-[12px] text-amber-700 dark:text-amber-300">🔗 {selection.referenceNotice}</p>}
  <h3 className="text-sm font-semibold text-ink">{selection.displayLabel ?? 'Cited passage'}</h3>
  {selection.pageNumber != null && <p className="mt-1 text-[12px] text-muted">Selected page: {selection.pageNumber}</p>}
  {selection.sourcePages?.length > 1 && <p className="mt-1 text-[12px] text-muted">Source pages: {selection.sourcePages.join(', ')}</p>}
  {selection.headingPath?.length > 0 && <p className="mt-1 text-[12px] text-muted">{selection.headingPath.join(' › ')}</p>}
  {validOffsetRange(selection.startOffset, selection.endOffset) && <p className="mono mt-2 text-[11px] text-muted">Source offsets: {selection.startOffset}–{selection.endOffset}</p>}
  <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-2">
    {selection.text ? <mark className="rounded bg-yellow-200/60 px-0.5 text-ink">{selection.text}</mark> : 'No source text supplied.'}
  </p>
</aside>;

const DocumentPreview = ({ file, selection, onClose }) => {
  const dialogRef = useRef(null);
  const [showSourceText, setShowSourceText] = useState(false);
  const [outlinePage, setOutlinePage] = useState(null);
  const currentSelection = outlinePage == null ? selection : { pageNumber: outlinePage };
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  const url = pdfPageUrl(file.fileUrl, currentSelection?.pageNumber);
  const kind = previewKind(file.filename, url);
  const isPdf = /\.pdf(?:$|[?#])/i.test(file.fileUrl ?? '') || /\.pdf$/i.test(file.filename);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-label={file.filename}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      className="m-auto h-[86dvh] max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-6xl overflow-hidden rounded-(--radius-lg) border border-border bg-surface p-0 shadow-(--sh-lg) backdrop:bg-scrim/40"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex h-full w-full flex-col overflow-hidden"
      >
        <header className="flex h-(--topbar-h) shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <h2 className="min-w-0 flex-1 truncate font-display text-[14px] font-semibold text-ink" title={file.filename}>
            {file.filename}
          </h2>

          <div className="flex shrink-0 items-center gap-1">
            {selection && isPdf && <Button variant="ghost" size="sm" onClick={() => setShowSourceText((shown) => !shown)} aria-pressed={showSourceText} title="Toggle source text">
              Source text
            </Button>}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              disabled={!url}
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

        <div className="flex min-h-0 flex-1 flex-col bg-surface-2 sm:flex-row">
        <DocumentOutline outline={file.documentOutline} currentPage={currentSelection?.pageNumber} disabled={!url || !isPdf} onPageJump={setOutlinePage} />
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">
          {currentSelection?.referenceNotice && <p className="border-b border-border p-3 text-[12px] text-amber-700 dark:text-amber-300">🔗 {currentSelection.referenceNotice}</p>}
          {!url && <p role="alert" className="p-6 text-sm text-muted">No valid file URL was supplied for this source.</p>}
          {url && isPdf && currentSelection && <Suspense fallback={<p className="p-6 text-sm text-muted">Loading PDF viewer…</p>}>
            <PdfCitationPreview url={safeFileUrl(file.fileUrl)} selection={currentSelection} />
          </Suspense>}
          {url && kind === 'frame' && !(isPdf && currentSelection) && (
            <iframe
              src={url}
              title={file.filename}
              referrerPolicy="no-referrer"
              className="h-full w-full border-0 bg-surface"
            />
          )}

          {url && kind === 'image' && (
            <div className="flex h-full items-center justify-center p-4">
              <img
                src={url}
                alt={file.filename}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}

          {url && kind === 'docx' && <DocxPreview url={url} filename={file.filename} />}

          {url && kind === 'unsupported' && (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-4 rounded-full bg-blue-lt p-4">
                <FileQuestion className="h-7 w-7 text-blue" />
              </div>
              <p className="font-display text-base font-semibold text-ink">
                This file cannot be shown here
              </p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                This file type has no inline preview here. The assistant has already read this
                one — open it in a new tab to see it yourself.
              </p>
              <Button
                className="mt-5"
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-4 w-4" />
                Open in a new tab
              </Button>
            </div>
          )}
        </div>
        {currentSelection && (!isPdf || showSourceText || !url) && <SourceSelection selection={currentSelection} />}
        </div>
      </div>
    </dialog>,
    document.body
  );
};

export default DocumentPreview;
