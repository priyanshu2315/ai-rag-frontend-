import { AlertTriangle, FileText, Info } from 'lucide-react';
import Spinner from '../feedback/Spinner';
import DocumentDropzone from './DocumentDropzone';
import ProgressTree from './ProgressTree';
import useAutoScroll from '../../hooks/useAutoScroll';
import useDocumentProgress from '../../hooks/useDocumentProgress';
import { DOCUMENT_STATUS } from '../../constants/documentStatus';
import { MESSAGES } from '../../constants/messages';
import { PHASE } from '../../utils/progressReducer';

const STATUS_LINE = {
  [PHASE.CONNECTING]: 'Connecting…',
  [PHASE.RECONNECTING]: 'Connection dropped — reconnecting…',
  [PHASE.STREAMING]: 'Splitting and embedding…',
  [PHASE.SUMMARIZING]: 'Generating summary…',
  [PHASE.POLLING]: 'Live updates unavailable — checking the document status every few seconds…',
  [PHASE.COMPLETED]: 'Done.',
};

/**
 * The "Processing document" view for one document: overall page progress, the
 * live page → parent → child tree, and — when it goes wrong — the error and a
 * way to upload again.
 *
 * It is mounted for as long as the document is PROCESSING or FAILED and owns
 * the stream through `useDocumentProgress`, so leaving the page unmounts it and
 * aborts the connection.
 */
const ProcessingPanel = ({ document: doc, onUpload, uploading }) => {
  const progress = useDocumentProgress(doc);
  const { phase, reconnected, totalPages, currentPage, pages, events } = progress;

  // A refresh lands here already FAILED, with no event to take the reason from.
  const failed = doc.status === DOCUMENT_STATUS.FAILED || phase === PHASE.FAILED;
  const errored = failed || phase === PHASE.ERROR;
  // `message` is only ever set by a `failed` event or a stream error.
  const errorMessage = progress.message || MESSAGES.PROCESSING_FAILED;

  const { containerRef, contentRef } = useAutoScroll([events, phase]);

  const percent = totalPages && currentPage ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-live="polite">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2.5">
            {errored ? (
              <AlertTriangle className="h-4 w-4 shrink-0 text-red" />
            ) : (
              <Spinner className="shrink-0" />
            )}
            <h2 className="font-display text-[14px] font-semibold text-ink">
              {errored ? 'Processing failed' : 'Processing document'}
            </h2>
            <span className="flex min-w-0 items-center gap-1 text-[12px] text-muted">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{doc.filename}</span>
            </span>
            {!errored && totalPages && currentPage && (
              <span className="mono ml-auto shrink-0 text-[11px] text-muted">
                page {currentPage} / {totalPages}
              </span>
            )}
          </div>

          {!errored && (
            <>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-blue transition-[width] duration-300"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="mt-2 text-[12px] text-muted">
                {reconnected && phase !== PHASE.POLLING ? 'Processing… (reconnected) — ' : ''}
                {STATUS_LINE[phase]}
              </p>
            </>
          )}
        </div>
      </div>

      <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
        <div ref={contentRef} className="mx-auto max-w-3xl px-6 py-4">
          {errored && (
            <div className="mb-4 rounded-(--radius) border border-border bg-surface p-4">
              <p className="text-[13px] text-ink-2">{errorMessage}</p>
              <p className="mt-1 text-[12px] text-muted">
                Chat stays off for this document. Upload the file again to retry.
              </p>
              <div className="mt-3 max-w-xs">
                <DocumentDropzone onUpload={onUpload} uploading={uploading} />
              </div>
            </div>
          )}

          {reconnected && !errored && (
            <p className="mb-3 flex items-start gap-2 rounded-(--radius-sm) bg-blue-lt px-3 py-2 text-[12px] text-ink-2">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue" />
              Earlier progress can’t be replayed, so this only shows what happens from now on.
            </p>
          )}

          <ProgressTree pages={pages} totalPages={totalPages} />
        </div>
      </div>
    </div>
  );
};

export default ProcessingPanel;
