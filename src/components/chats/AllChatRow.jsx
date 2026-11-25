import { Link } from 'react-router-dom';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../badges/StatusBadge';
import { chatPath } from '../../constants/routes';
import { formatDateTime, formatRelative } from '../../utils/format';

const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-chip hover:text-ink';

/**
 * One row of the admin "All" list: title, owner, last used, message count.
 * Rename and delete only show on the admin's own chats — anyone else's opens
 * read-only.
 */
const AllChatRow = ({ chat, deleting = false, onRename, onDelete }) => {
  const title = chat.title || 'New Conversation';
  const ownerName = chat.owner?.name || chat.owner?.email || 'Unknown user';
  const count = Number.isFinite(chat.messageCount) ? chat.messageCount : null;

  return (
    <li className="flex items-center gap-1 border-t border-border pr-2 first:border-t-0 hover:bg-surface-2">
      <Link to={chatPath(chat.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <MessageSquare className="h-4 w-4 shrink-0 text-muted" />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-medium text-ink" title={title}>{title}</span>
            {chat.isMine && <Badge tone="working" className="shrink-0">You</Badge>}
          </span>
          <span className="block truncate text-[12px] text-muted" title={chat.owner?.email || undefined}>
            {ownerName}
            {chat.owner?.name && chat.owner?.email && <span className="hidden text-muted-2 sm:inline"> · {chat.owner.email}</span>}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <time className="mono text-[11.5px] text-muted" dateTime={chat.updatedAt} title={formatDateTime(chat.updatedAt)}>
            {formatRelative(chat.updatedAt)}
          </time>
          {count !== null && (
            <span className="mono text-[11px] text-muted-2">{count} {count === 1 ? 'message' : 'messages'}</span>
          )}
        </span>
      </Link>
      {chat.isMine ? (
        <>
          <button type="button" className={iconButton} onClick={() => onRename(chat)} aria-label={`Rename ${title}`} title="Rename">
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            className={`${iconButton} hover:bg-red-bg hover:text-red`}
            onClick={() => onDelete(chat)}
            disabled={deleting}
            aria-label={`Delete ${title}`}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      ) : (
        // Keeps the columns lined up with the rows that have actions.
        <span className="w-[4.75rem] shrink-0" aria-hidden="true" />
      )}
    </li>
  );
};

export default AllChatRow;
