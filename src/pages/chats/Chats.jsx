import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, MessageSquarePlus, MessagesSquare, Pencil, Trash2 } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import Button from '../../components/buttons/Button';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import RenameChatDialog from '../../components/chats/RenameChatDialog';
import useChats from '../../hooks/useChats';
import useStartChat from '../../hooks/useStartChat';
import usePageTitle from '../../hooks/usePageTitle';
import { chatPath } from '../../constants/routes';
import { formatDate, formatTime } from '../../utils/format';

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const when = (iso) => (iso ? (isToday(iso) ? formatTime(iso) : formatDate(iso)) : '');

const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-chip hover:text-ink';

/**
 * The user's global chats, most recently used first. Each searches every
 * document the user can access. Rename and delete live here; a document's
 * own chat is reached from the Knowledge base instead.
 */
const Chats = () => {
  usePageTitle('Chats');
  const { chats, loaded, loading, error, savingId, deletingId, reload, rename, remove } = useChats();
  const { start, creating } = useStartChat();
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const confirmDelete = async () => {
    if (await remove(deleting.id)) setDeleting(null);
  };

  return (
    <>
      <PageHead
        title="Chats"
        subtitle="Conversations across all your documents"
        actions={
          <Button size="sm" className="h-9" onClick={() => start()} loading={creating}>
            {!creating && <MessageSquarePlus className="h-4 w-4" />} New chat
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          {error && chats.length === 0 ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading && !loaded ? (
            <ListSkeleton rows={6} />
          ) : chats.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No chats yet"
              description="Start a chat to ask questions across every document you can access."
              action={<Button onClick={() => start()} loading={creating}>New chat</Button>}
            />
          ) : (
            <ul className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
              {chats.map((chat) => (
                <li key={chat.id} className="flex items-center gap-1 border-t border-border pr-2 first:border-t-0 hover:bg-surface-2">
                  <Link to={chatPath(chat.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink" title={chat.title}>
                      {chat.title || 'New Conversation'}
                    </span>
                    <span className="mono shrink-0 text-[11.5px] text-muted">{when(chat.updatedAt)}</span>
                  </Link>
                  <button type="button" className={iconButton} onClick={() => setRenaming(chat)} aria-label={`Rename ${chat.title}`} title="Rename">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`${iconButton} hover:bg-red-bg hover:text-red`}
                    onClick={() => setDeleting(chat)}
                    disabled={deletingId === chat.id}
                    aria-label={`Delete ${chat.title}`}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {renaming && (
        <RenameChatDialog
          chat={renaming}
          saving={savingId === renaming.id}
          onRename={rename}
          onClose={() => setRenaming(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this chat?"
          message={`“${deleting.title || 'New Conversation'}” and all its messages will be permanently deleted.`}
          confirmLabel="Delete chat"
          loading={deletingId === deleting.id}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
};

export default Chats;
