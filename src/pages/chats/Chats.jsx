import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, MessageSquarePlus, MessagesSquare, Pencil, Search, Trash2 } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import Button from '../../components/buttons/Button';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import RenameChatDialog from '../../components/chats/RenameChatDialog';
import ChatScopeToggle from '../../components/chats/ChatScopeToggle';
import AllChatRow from '../../components/chats/AllChatRow';
import useChats from '../../hooks/useChats';
import useAllChats from '../../hooks/useAllChats';
import usePermission from '../../hooks/usePermission';
import { scopeChosen } from '../../redux/slices/chatsSlice';
import { CHAT_SCOPE } from '../../constants/chatScope';
import useStartChat from '../../hooks/useStartChat';
import usePageTitle from '../../hooks/usePageTitle';
import { chatPath } from '../../constants/routes';
import { formatDate, formatTime } from '../../utils/format';

const isToday = (iso) => new Date(iso).toDateString() === new Date().toDateString();
const when = (iso) => (iso ? (isToday(iso) ? formatTime(iso) : formatDate(iso)) : '');

/** Title, owner name or owner email contains every word typed. */
const matches = (chat, query) => {
  const haystack = [chat.title, chat.owner?.name, chat.owner?.email].filter(Boolean).join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
};

const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-chip hover:text-ink';

/**
 * The user's global chats, most recently used first. Each searches every
 * document the user can access. Rename and delete live here; a document's
 * own chat is reached from the Knowledge base instead.
 *
 * Admins also get a "My" | "All" toggle. The choice is the URL's `?scope=all`,
 * so a refresh or a link keeps it; "All" lists every user's chats with their
 * owner, searchable here in the browser. Other users never see the toggle, and
 * a `?scope=all` in their URL is simply dropped.
 */
const Chats = () => {
  usePageTitle('Chats');
  const dispatch = useDispatch();
  const { isAdmin } = usePermission();
  const allDenied = useSelector((state) => state.chats.allDenied);
  const [params, setParams] = useSearchParams();
  const canSeeAll = isAdmin && !allDenied;
  const asked = params.get('scope');
  const scope = canSeeAll && asked === CHAT_SCOPE.ALL ? CHAT_SCOPE.ALL : CHAT_SCOPE.MINE;
  const showAll = scope === CHAT_SCOPE.ALL;

  const { chats, loaded, loading, error, savingId, deletingId, reload, rename, remove } = useChats();
  const all = useAllChats(showAll);
  const { start, creating } = useStartChat();
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [query, setQuery] = useState('');
  const shown = useMemo(
    () => (query.trim() ? all.chats.filter((chat) => matches(chat, query)) : all.chats),
    [all.chats, query]
  );

  // Remembered for "back to Chats" and for the refresh after an answer.
  useEffect(() => {
    dispatch(scopeChosen(scope));
  }, [dispatch, scope]);

  // A scope this account cannot use (not an admin, or just refused with a 403) leaves the URL.
  useEffect(() => {
    if (asked && asked !== scope) {
      setParams((current) => {
        const updated = new URLSearchParams(current);
        updated.delete('scope');
        return updated;
      }, { replace: true });
    }
  }, [asked, scope, setParams]);

  const chooseScope = (next) => {
    setQuery('');
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next === CHAT_SCOPE.ALL) updated.set('scope', CHAT_SCOPE.ALL);
      else updated.delete('scope');
      return updated;
    }, { replace: true });
  };

  const confirmDelete = async () => {
    if (await remove(deleting.id)) setDeleting(null);
  };

  return (
    <>
      <PageHead
        title="Chats"
        subtitle={showAll ? "Every user's conversations — other people's open read-only" : 'Conversations across all your documents'}
        actions={
          <Button size="sm" className="h-9" onClick={() => start()} loading={creating}>
            {!creating && <MessageSquarePlus className="h-4 w-4" />} New chat
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
          {canSeeAll && (
            <div className="flex flex-wrap items-center gap-3">
              <ChatScopeToggle value={scope} onChange={chooseScope} />
              {showAll && (
                <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-(--radius) border border-input-border bg-surface px-3 text-muted focus-within:border-blue sm:max-w-sm">
                  <Search className="h-4 w-4 shrink-0" />
                  <span className="sr-only">Search chats by title or owner</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search title, name or email…"
                    className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-2 sm:text-[13.5px]"
                  />
                </label>
              )}
            </div>
          )}

          {showAll ? (
            all.error && all.chats.length === 0 ? (
              <ErrorState message={all.error} onRetry={all.reload} />
            ) : !all.loaded ? (
              <ListSkeleton rows={6} />
            ) : shown.length === 0 ? (
              <EmptyState
                icon={query.trim() ? Search : MessagesSquare}
                title={query.trim() ? 'No matching chats' : 'No chats yet'}
                description={query.trim() ? `No chat title, name or email contains “${query.trim()}”.` : 'Nobody has started a chat yet.'}
              />
            ) : (
              <ul className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface" aria-busy={all.loading}>
                {shown.map((chat) => (
                  <AllChatRow
                    key={chat.id}
                    chat={chat}
                    deleting={deletingId === chat.id}
                    onRename={setRenaming}
                    onDelete={setDeleting}
                  />
                ))}
              </ul>
            )
          ) : error && chats.length === 0 ? (
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
