import { MessageSquareText } from 'lucide-react';
import MessageBubble from './MessageBubble';
import EmptyState from '../feedback/EmptyState';
import ErrorState from '../feedback/ErrorState';
import Spinner from '../feedback/Spinner';
import useAutoScroll from '../../hooks/useAutoScroll';
import { MESSAGES } from '../../constants/messages';

const MessageList = ({ messages, loading, error, sending, contextLabel, onRetry, onReload }) => {
  // Tokens arrive one at a time, so the scroller has to follow content growth,
  // not just message count — that is what the ResizeObserver in the hook does.
  const { containerRef, contentRef } = useAutoScroll([messages.length, sending]);
  const isEmpty = messages.length === 0;

  // The stored transcript is still on its way. Showing the empty state here
  // would read as "no history", and then flip to a full conversation.
  // The conversation never loaded, so there is no id to thread a question
  // onto and the composer is disabled. Without a way back the screen would be
  // a dead end, so the reload lives here rather than only in a toast.
  if (error && isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <ErrorState message={error} onRetry={onReload} />
      </div>
    );
  }

  if (loading && isEmpty) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted">
        <Spinner />
        {MESSAGES.LOADING_CONVERSATION}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
      <div ref={contentRef} className={isEmpty ? 'h-full min-w-0' : 'min-w-0'}>
        {isEmpty ? (
          <EmptyState
            className="h-full"
            icon={MessageSquareText}
            title="Ask your documents anything"
            description={`Answers are drawn from ${contextLabel}. Upload a file on the left to narrow the context.`}
          />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} onRetry={onRetry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageList;
