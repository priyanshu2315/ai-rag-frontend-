import { useEffect, useState } from 'react';
import { Eraser, Eye, Layers, Pencil, Trash2 } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import PageHead from '../../components/layout/PageHead';
import Button from '../../components/buttons/Button';
import MessageList from '../../components/chat/MessageList';
import Composer from '../../components/chat/Composer';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import { ChatSkeleton, TextSkeleton } from '../../components/feedback/Skeletons';
import RenameChatDialog from '../../components/chats/RenameChatDialog';
import DocumentPreview from '../../components/documents/DocumentPreview';
import ProcessingPanel from '../../components/documents/ProcessingPanel';
import useChat from '../../hooks/useChat';
import useChats from '../../hooks/useChats';
import usePageTitle from '../../hooks/usePageTitle';
import usePermission from '../../hooks/usePermission';
import useQueuedQuestion from '../../hooks/useQueuedQuestion';
import { canDeleteDocument, isNotReady, isSummaryPending, SUMMARY_STATUS } from '../../constants/documentStatus';
import { MESSAGES } from '../../constants/messages';
import { PERMISSIONS } from '../../constants/permissions';
import { ROUTES, chunksPath } from '../../constants/routes';
import notify from '../../utils/notify';

const actionClass = 'h-9 shrink-0';
const dangerClass = `${actionClass} hover:bg-red-bg hover:text-red`;

/**
 * One page, two contexts: a global chat (`/chat/:chatId`, every document this
 * account can access) and a document's own chat inside the Knowledge base.
 *
 * Thin by design (§2): the shell owns documents, `useChat` owns the
 * conversation and the in-flight stream, and this page only wires them up.
 * A document still processing (or failed) shows the progress panel instead of
 * the transcript, and the composer stays off until it is COMPLETED.
 */
const ChatPage = () => {
  const { activeDocument, upload, uploading, requestDelete, deletingId } = useOutletContext();
  const {
    chatId, documentId, messages, loading, error, notFound, sending, clearing, ready,
    send, stop, retry, reload, clear,
  } = useChat();
  const { chats, loaded: chatsLoaded, error: chatsError, savingId, deletingId: deletingChatId, rename, remove } = useChats();
  const navigate = useNavigate();
  const { can } = usePermission();
  const [previewing, setPreviewing] = useState(false);
  const [dialog, setDialog] = useState(null); // 'clear' | 'rename' | 'delete-chat' | null

  const listed = chatId ? chats.find((item) => item.id === chatId) : null;
  const chat = chatId ? listed ?? { id: chatId, title: null } : null;
  const chatTitle = chat?.title || 'New Conversation';
  // Until the list arrives the title is unknown — a shimmer, not a wrong name.
  const titleLoading = Boolean(chatId) && !listed && !chatsLoaded && !chatsError;
  const contextLabel = activeDocument?.filename ?? 'all your documents';
  const locked = Boolean(documentId) && (!activeDocument || isNotReady(activeDocument));

  usePageTitle(chatId ? chatTitle : contextLabel);
  // A question from the header search or the new-chat screen waits here until
  // the new chat has loaded, then is asked once.
  useQueuedQuestion({ enabled: Boolean(chatId), ready, sending, send });

  // A chat that was deleted elsewhere, or a link to someone else's: back to
  // the list. (A document that left the user's roles is handled by the shell.)
  useEffect(() => {
    if (!chatId || !notFound) return;
    notify.info(MESSAGES.CHAT_UNAVAILABLE);
    navigate(ROUTES.CHATS, { replace: true });
  }, [chatId, notFound, navigate]);

  const closeDialog = () => setDialog(null);

  // The dialogs stay open through the request so their own spinner can show.
  const confirmClear = async () => {
    if (await clear()) closeDialog();
  };

  const confirmDeleteChat = async () => {
    if (await remove(chatId)) navigate(ROUTES.CHATS, { replace: true });
  };

  const globalActions = chatId && (
    <>
      <Button variant="ghost" size="sm" className={actionClass} onClick={() => setDialog('rename')} title="Rename this chat">
        <Pencil className="h-4 w-4" />
        <span className="hidden sm:inline">Rename</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={dangerClass}
        onClick={() => setDialog('delete-chat')}
        disabled={sending}
        title={sending ? 'Wait for the answer to finish' : 'Delete this chat'}
      >
        <Trash2 className="h-4 w-4" />
        <span className="hidden sm:inline">Delete</span>
      </Button>
    </>
  );

  const documentActions = activeDocument && (
    <>
      {activeDocument.fileUrl && (
        <Button variant="ghost" size="sm" className={actionClass} onClick={() => setPreviewing(true)} title="Preview this file">
          <Eye className="h-4 w-4" />
          <span className="hidden sm:inline">Preview</span>
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        className={actionClass}
        onClick={() => navigate(chunksPath(activeDocument.id))}
        title="Inspect this document's chunks"
      >
        <Layers className="h-4 w-4" />
        <span className="hidden sm:inline">Chunks</span>
      </Button>

      {!locked && messages.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className={actionClass}
          onClick={() => setDialog('clear')}
          title={`Clear your chat with ${contextLabel}`}
        >
          <Eraser className="h-4 w-4" />
          <span className="hidden sm:inline">Clear chat</span>
        </Button>
      )}

      {/* Deleting removes the file from the library for everyone — admin only. */}
      {can(PERMISSIONS.DELETE_DOCUMENT) && (
        <Button
          variant="ghost"
          size="sm"
          className={dangerClass}
          onClick={() => requestDelete(activeDocument)}
          disabled={Boolean(deletingId) || !canDeleteDocument(activeDocument)}
          loading={deletingId === activeDocument.id}
          title={canDeleteDocument(activeDocument)
            ? `Delete ${activeDocument.filename}`
            : 'Only completed or failed documents can be deleted'}
        >
          {deletingId !== activeDocument.id && <Trash2 className="h-4 w-4" />}
          <span className="hidden sm:inline">Delete</span>
        </Button>
      )}
    </>
  );

  return (
    <>
      <PageHead
        crumbs={chatId
          ? [{ label: 'Chats', to: ROUTES.CHATS }]
          : [{ label: 'Knowledge base', to: ROUTES.KNOWLEDGE_BASE }]}
        title={chatId
          ? (titleLoading ? <TextSkeleton className="h-4 w-56" /> : chatTitle)
          : activeDocument ? contextLabel : <TextSkeleton className="h-4 w-48" />}
        subtitle={chatId ? 'Answering from every document you can access' : 'Answering from this document only'}
        actions={chatId ? globalActions : documentActions}
      />

      {previewing && activeDocument && (
        <DocumentPreview file={activeDocument} onClose={() => setPreviewing(false)} />
      )}

      {dialog === 'clear' && (
        <ConfirmDialog
          title="Clear this conversation?"
          message={`Every message in your chat with ${contextLabel} will be permanently deleted. This can't be undone.`}
          confirmLabel="Clear chat"
          loading={clearing}
          onConfirm={confirmClear}
          onCancel={closeDialog}
        />
      )}

      {dialog === 'rename' && chat && (
        <RenameChatDialog chat={chat} saving={savingId === chat.id} onRename={rename} onClose={closeDialog} />
      )}

      {dialog === 'delete-chat' && (
        <ConfirmDialog
          title="Delete this chat?"
          message={`“${chatTitle}” and all its messages will be permanently deleted.`}
          confirmLabel="Delete chat"
          loading={deletingChatId === chatId}
          onConfirm={confirmDeleteChat}
          onCancel={closeDialog}
        />
      )}

      {!locked && activeDocument && (isSummaryPending(activeDocument) ||
        activeDocument.summaryStatus === SUMMARY_STATUS.FAILED) && (
        <div className="border-b border-border bg-chip px-4 py-2 text-center text-xs text-ink-2" role="status">
          {isSummaryPending(activeDocument)
            ? activeDocument.summaryStatus === SUMMARY_STATUS.PROCESSING
              ? 'Questions ready; summary processing.'
              : 'Questions ready; summary pending.'
            : 'Summary failed — document questions are still available.'}
        </div>
      )}

      {locked ? (
        activeDocument ? (
          <ProcessingPanel
            document={activeDocument}
            onUpload={can(PERMISSIONS.UPLOAD_DOCUMENT) ? upload : undefined}
            uploading={uploading}
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-hidden"><ChatSkeleton /></div>
        )
      ) : (
        <MessageList
          messages={messages}
          loading={loading}
          error={notFound ? null : error}
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
