import cn from '../../utils/cn';
import { CHAT_SCOPE } from '../../constants/chatScope';

const OPTIONS = [
  [CHAT_SCOPE.MINE, 'My'],
  [CHAT_SCOPE.ALL, 'All'],
];

/** "My" | "All" segmented control — admins only; the caller decides whether to render it. */
const ChatScopeToggle = ({ value, onChange, className }) => (
  <div role="group" aria-label="Whose chats" className={cn('inline-flex rounded-(--radius-sm) border border-border-2 bg-surface p-0.5', className)}>
    {OPTIONS.map(([id, label]) => (
      <button
        key={id}
        type="button"
        aria-pressed={value === id}
        onClick={() => value !== id && onChange(id)}
        title={id === CHAT_SCOPE.ALL ? "Every user's chats" : 'Your chats'}
        className={cn(
          'min-h-8 rounded-[4px] px-3 text-[12.5px] font-medium transition-colors',
          value === id ? 'bg-blue-lt text-blue' : 'text-muted hover:text-ink'
        )}
      >
        {label}
      </button>
    ))}
  </div>
);

export default ChatScopeToggle;
