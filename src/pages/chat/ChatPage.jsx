import { useEffect, useState } from 'react';
import { Eraser, Eye, FileText, Layers, Trash2 } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Topbar from '../../components/layout/Topbar';
import Button from '../../components/buttons/Button';
import MessageList from '../../components/chat/MessageList';
import Composer from '../../components/chat/Composer';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import DocumentPreview from '../../components/documents/DocumentPreview';
import ProcessingPanel from '../../components/documents/ProcessingPanel';
import useChat from '../../hooks/useChat';
import useActiveDocumentId from '../../hooks/useActiveDocumentId';
import usePageTitle from '../../hooks/usePageTitle';
import { canDeleteDocument, canRequestSummary, isNotReady, isSummaryPending, SUMMARY_STATUS } from '../../constants/documentStatus';
import { MESSAGES } from '../../constants/messages';
import { chunksPath } from '../../constants/routes';

/**
 * Thin by design (§2): the shell owns documents, `useChat` owns the
 * conversation and the in-flight stream, and this page only wires them up.
 *
 * A document that is still processing (or failed) shows the progress panel
 * instead of the transcript, and the composer stays off until it is COMPLETED.
 */
const ChatPage = () => {
  usePageTitle('Chat');

  const { activeDocument, upload, uploading, requestDelete, deletingId, openDocuments } = useOutletContext();
  const { messages, loading, error, sending, clearing, ready, send, stop, retry, reload, clear } =
    useChat();
  const navigate = useNavigate();
  const documentId = useActiveDocumentId();
  const [previewing, setPreviewing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [progressDocumentId, setProgressDocumentId] = useState(null);
  const progress = useSelector((state) => documentId
    ? state.documents.progressById[documentId]
    : null);

  // Keep the upload's progress visible for this page visit after chunking and
  // summary generation finish. The local latch is discarded when ChatPage
  // unmounts, while the Redux timeline remains available to the chunk inspector.
  useEffect(() => {
    if (activeDocument && (activeDocument.fresh || (progress && !progress.reconnected))) {
      setProgressDocumentId(activeDocument.id);
    }
  }, [activeDocument?.id, activeDocument?.fresh, progress?.reconnected]);

  const contextLabel = activeDocument?.filename ?? MESSAGES.ALL_DOCUMENTS;
  const locked = Boolean(documentId) && (!activeDocument || isNotReady(activeDocument));

  // The dialog stays open through the request so its own spinner can show —
  // it only closes once `clear` has actually settled.
  const confirmClear = async () => {
    const ok = await clear();
    if (ok) setConfirmingClear(false);
  };

  return (
    <>
      <Topbar
        title="Chat"
        subtitle={`Answering from ${contextLabel}`}
        onOpenDocuments={openDocuments}
        actions={
          <>
            {/* Both belong to one document — the global view has no file to
                open or chunks to list. */}
            {activeDocument && (
              <>
                {activeDocument.fileUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-10 shrink-0 xl:h-8"
                    onClick={() => setPreviewing(true)}
                    title="Preview this file"
                  >
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Preview</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 xl:h-8"
                  onClick={() => send('Summarize this document.')}
                  disabled={!canRequestSummary(activeDocument) || !ready || sending}
                  title={canRequestSummary(activeDocument) ? 'Ask for this document summary' : 'Summary is not ready yet'}
                  aria-label="Ask for document summary"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Summary</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 shrink-0 xl:h-8"
                  onClick={() => navigate(chunksPath(activeDocument.id))}
                  title="See all chunks"
                >
                  <Layers className="h-4 w-4" />
                  <span className="hidden sm:inline">See all chunks</span>
                </Button>

              </>
            )}

            {/* Works for the global conversation too, so it is not gated on
                `activeDocument` — only on there being something to clear. */}
            {!locked && messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 shrink-0 xl:h-8"
                onClick={() => setConfirmingClear(true)}
                title={`Clear the conversation for ${contextLabel}`}
              >
                <Eraser className="h-4 w-4" />
                <span className="hidden sm:inline">Clear chat</span>
              </Button>
            )}
          </>
        }
      />

      {previewing && activeDocument && (
        <DocumentPreview file={activeDocument} onClose={() => setPreviewing(false)} />
      )}

      {confirmingClear && (
        <ConfirmDialog
          title="Clear this conversation?"
          message={`Every message in ${contextLabel} will be permanently deleted. This can't be undone.`}
          confirmLabel="Clear chat"
          loading={clearing}
          onConfirm={confirmClear}
          onCancel={() => setConfirmingClear(false)}
        />
      )}

      {!locked && activeDocument && (isSummaryPending(activeDocument) ||
        activeDocument.summaryStatus === SUMMARY_STATUS.FAILED) && (
        <div className="border-b border-border bg-surface-2 px-4 py-2 text-center text-xs text-ink-2" role="status">
          {isSummaryPending(activeDocument)
            ? activeDocument.summaryStatus === SUMMARY_STATUS.PROCESSING
              ? 'Questions ready; summary processing.'
              : 'Questions ready; summary pending.'
            : 'Summary failed — document questions are still available.'}
        </div>
      )}

      {locked ? (
        activeDocument ? (
          <ProcessingPanel document={activeDocument} onUpload={upload} uploading={uploading} />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted">Loading document…</div>
        )
      ) : (
        <>
          {progressDocumentId === activeDocument?.id && progress && (
            <ProcessingPanel document={activeDocument} compact />
          )}
          <MessageList
            messages={messages}
            loading={loading}
            error={error}
            sending={sending}
            contextLabel={contextLabel}
            onRetry={retry}
            onReload={reload}
          />
        </>
      )}

      <Composer
        documentAction={activeDocument && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mb-0.5 shrink-0 text-muted-2 opacity-30 transition-[color,background-color,opacity] hover:text-red hover:opacity-100 focus-visible:text-red focus-visible:opacity-100 disabled:opacity-20"
            onClick={() => requestDelete(activeDocument)}
            disabled={Boolean(deletingId) || !canDeleteDocument(activeDocument)}
            loading={deletingId === activeDocument.id}
            aria-label={`Delete ${activeDocument.filename}`}
            title={canDeleteDocument(activeDocument)
              ? `Delete ${activeDocument.filename}`
              : 'Only completed or failed documents can be deleted'}
          >
            {deletingId !== activeDocument.id && <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
        onSend={send}
        onStop={stop}
        sending={sending}
        disabled={locked || (!ready && !sending)}
        placeholder={locked ? MESSAGES.CHAT_LOCKED : `Ask about ${contextLabel}…`}
      />
    </>
  );
};

export default ChatPage;
