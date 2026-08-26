import { MessageSquareText } from 'lucide-react';
import MessageBubble from './MessageBubble';
import EmptyState from '../feedback/EmptyState';
import useAutoScroll from '../../hooks/useAutoScroll';

const MessageList = ({ messages, sending, contextLabel, onRetry }) => {
  // Tokens arrive one at a time, so the scroller has to follow content growth,
  // not just message count — that is what the ResizeObserver in the hook does.
  const { containerRef, contentRef } = useAutoScroll([messages.length, sending]);
  const isEmpty = messages.length === 0;

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-y-auto">
      <div ref={contentRef} className={isEmpty ? 'h-full' : undefined}>
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
