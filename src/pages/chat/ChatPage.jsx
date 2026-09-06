import { useState } from 'react';
import { Eye, Layers } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import Button from '../../components/buttons/Button';
import MessageList from '../../components/chat/MessageList';
import Composer from '../../components/chat/Composer';
import DocumentPreview from '../../components/documents/DocumentPreview';
import useChat from '../../hooks/useChat';
import usePageTitle from '../../hooks/usePageTitle';
import { MESSAGES } from '../../constants/messages';
import { chunksPath } from '../../constants/routes';

/**
 * Thin by design (§2): the shell owns documents, `useChat` owns the
 * conversation and the in-flight stream, and this page only wires them up.
 */
const ChatPage = () => {
  usePageTitle('Chat');

  const { activeDocument } = useOutletContext();
  const { messages, loading, error, sending, ready, send, stop, retry, reload } = useChat();
  const navigate = useNavigate();
  const [previewing, setPreviewing] = useState(false);

  const contextLabel = activeDocument?.filename ?? MESSAGES.ALL_DOCUMENTS;

  return (
    <>
      <Topbar
        title="Chat"
        subtitle={`Answering from ${contextLabel}`}
        // Both actions belong to one document, and the global view has no
        // document to open — hence nothing here until one is selected.
        actions={
          activeDocument && (
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
          )
        }
      />

      {previewing && activeDocument && (
        <DocumentPreview file={activeDocument} onClose={() => setPreviewing(false)} />
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

      <Composer
        onSend={send}
        onStop={stop}
        sending={sending}
        disabled={!ready && !sending}
        placeholder={`Ask about ${contextLabel}…`}
      />
    </>
  );
};

export default ChatPage;
