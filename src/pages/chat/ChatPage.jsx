import { useState } from 'react';
import { Eraser, Eye, Layers } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import Button from '../../components/buttons/Button';
import MessageList from '../../components/chat/MessageList';
import Composer from '../../components/chat/Composer';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import DocumentPreview from '../../components/documents/DocumentPreview';
import ProcessingPanel from '../../components/documents/ProcessingPanel';
import useChat from '../../hooks/useChat';
import usePageTitle from '../../hooks/usePageTitle';
import { isNotReady } from '../../constants/documentStatus';
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

  const { activeDocument, upload, uploading } = useOutletContext();
  const { messages, loading, error, sending, clearing, ready, send, stop, retry, reload, clear } =
    useChat();
  const navigate = useNavigate();
  const [previewing, setPreviewing] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const contextLabel = activeDocument?.filename ?? MESSAGES.ALL_DOCUMENTS;
  const locked = isNotReady(activeDocument);

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

      {locked ? (
        <ProcessingPanel document={activeDocument} onUpload={upload} uploading={uploading} />
      ) : (
        <MessageList
          messages={messages}
          loading={loading}
          error={error}
          sending={sending}
          contextLabel={contextLabel}
          onRetry={retry}
          onReload={reload}
        />
      )}

      <Composer
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
