import { memo } from 'react';
import { Bot, User, AlertTriangle, RotateCw } from 'lucide-react';
import cn from '../../utils/cn';
import { formatTime } from '../../utils/format';
import { MESSAGES, ROLE } from '../../constants/messages';
import Markdown from './Markdown';
import TypingDots from './TypingDots';
import AnswerTimeline from './AnswerTimeline';

/**
 * Memoised, and it earns it here: a streaming answer dispatches once per
 * fragment, so without this every settled bubble would re-render on every
 * token. Immer keeps the identity of untouched messages, so only the bubble
 * being streamed into actually re-renders.
 */
const MessageBubble = memo(({ message, onRetry }) => {
  const isUser = message.role === ROLE.USER;
  const { content, streaming, failed, interrupted, stopped, muted, retryable, notice } = message;
  const steps = message.steps ?? [];

  return (
    <div className={cn('flex min-w-0 gap-3', isUser && 'flex-row-reverse')}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser && 'bg-navy text-white',
          !isUser && failed && 'bg-red-bg text-red',
          !isUser && !failed && 'bg-blue-lt text-blue'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </span>

      <div className={cn('min-w-0', isUser ? 'max-w-[min(640px,80%)] text-right' : 'max-w-[min(760px,88%)]')}>
        <div
          className={cn(
            'break-words rounded-(--radius) px-4 py-2.5 text-left text-sm leading-relaxed',
            isUser && 'whitespace-pre-wrap rounded-tr-sm bg-navy text-white',
            !isUser && 'rounded-tl-sm border shadow-(--sh-sm)',
            !isUser && failed && 'border-red/30 bg-red-bg text-red',
            !isUser && !failed && 'border-border bg-surface',
            !isUser && !failed && muted ? 'text-muted' : !isUser && !failed && 'text-ink'
          )}
        >
          {/* eslint-disable-next-line no-nested-ternary */}
          {isUser ? (
            // The user's own text is never parsed as markup.
            content
          ) : failed ? (
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{content}</span>
            </span>
          ) : (
            <>
              {steps.length > 0 && (
                <AnswerTimeline
                  steps={steps}
                  streaming={streaming}
                  separated={Boolean(content)}
                />
              )}

              {content && (
                <>
                  <Markdown>{content}</Markdown>
                  {streaming && <span className="caret" aria-hidden="true" />}
                </>
              )}

              {/* Only until the agent says what it is doing — after that the
                  timeline is the better answer to "is anything happening". */}
              {streaming && !content && steps.length === 0 && <TypingDots />}
            </>
          )}
        </div>

        {(interrupted || stopped) && (
          <p className="mt-1 px-1 text-[11px] text-muted">
            {stopped ? MESSAGES.STOPPED : notice}
          </p>
        )}

        {retryable && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 inline-flex items-center gap-1.5 rounded-(--radius-sm) border border-border-2 bg-surface px-2.5 py-1 text-[12px] font-medium text-ink-2 transition-colors hover:bg-surface-2"
          >
            <RotateCw className="h-3 w-3" />
            Try again
          </button>
        )}

        {message.createdAt && !streaming && (
          <p className="mono mt-1 px-1 text-[11px] text-muted-2">{formatTime(message.createdAt)}</p>
        )}
      </div>
    </div>
  );
});

MessageBubble.displayName = 'MessageBubble';

export default MessageBubble;
