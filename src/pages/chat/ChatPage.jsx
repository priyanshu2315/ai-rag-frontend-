import { useOutletContext } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import MessageList from '../../components/chat/MessageList';
import Composer from '../../components/chat/Composer';
import useChat from '../../hooks/useChat';
import usePageTitle from '../../hooks/usePageTitle';
import { MESSAGES } from '../../constants/messages';

/**
 * Thin by design (§2): the shell owns documents, `useChat` owns the
 * conversation and the in-flight stream, and this page only wires them up.
 */
const ChatPage = () => {
  usePageTitle('Chat');

  const { activeDocument } = useOutletContext();
  const { messages, sending, send, stop, retry } = useChat();

  const contextLabel = activeDocument?.filename ?? MESSAGES.ALL_DOCUMENTS;

  return (
    <>
      <Topbar title="Chat" subtitle={`Answering from ${contextLabel}`} />

      <MessageList
        messages={messages}
        sending={sending}
        contextLabel={contextLabel}
        onRetry={retry}
      />

      <Composer
        onSend={send}
        onStop={stop}
        sending={sending}
        placeholder={`Ask about ${contextLabel}…`}
      />
    </>
  );
};

export default ChatPage;
