import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { MessageSquare, MessageSquareText } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import Composer from '../../components/chat/Composer';
import EmptyState from '../../components/feedback/EmptyState';
import { ListSkeleton } from '../../components/feedback/Skeletons';
import useStartChat from '../../hooks/useStartChat';
import useChats from '../../hooks/useChats';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, chatPath } from '../../constants/routes';

const RECENT = 5;

/**
 * The empty "new chat" screen. No chat exists yet: the first question creates
 * one and moves to it, where the question is asked. Recent chats are offered
 * underneath so picking up an old thread is one click.
 */
const NewChat = () => {
  usePageTitle('New chat');
  const { start, creating } = useStartChat();
  const { chats, loaded, error } = useChats();
  const hasDocuments = useSelector((state) => state.documents.list.length > 0);
  const recent = chats.slice(0, RECENT);

  return (
    <>
      <PageHead title="New chat" subtitle="Ask across every document you can access" />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <EmptyState
          className="flex-1"
          icon={MessageSquareText}
          title="What would you like to know?"
          description={hasDocuments
            ? 'Your first question starts a new chat. Answers cite the documents they come from.'
            : 'No documents are available to you yet, so answers will have nothing to draw on.'}
        />

        {/* A failed load just drops the section; it never shimmers forever. */}
        {!loaded && !error && (
          <section className="mx-auto mb-6 w-full max-w-xl px-4">
            <p className="mono mb-2 text-[11px] uppercase tracking-[0.08em] text-muted">Recent chats</p>
            <ListSkeleton rows={3} className="rounded-(--radius)" />
          </section>
        )}

        {loaded && recent.length > 0 && (
          <section className="mx-auto mb-6 w-full max-w-xl px-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="mono text-[11px] uppercase tracking-[0.08em] text-muted">Recent chats</h2>
              <Link to={ROUTES.CHATS} className="text-[12.5px] font-medium text-blue hover:underline">All chats</Link>
            </div>
            <ul className="overflow-hidden rounded-(--radius) border border-border bg-surface">
              {recent.map((chat) => (
                <li key={chat.id} className="border-t border-border first:border-t-0">
                  <Link to={chatPath(chat.id)} className="flex items-center gap-2.5 px-3 py-2.5 text-[13px] hover:bg-surface-2">
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted" />
                    <span className="truncate text-ink">{chat.title || 'New Conversation'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Composer
        onSend={(question) => start(question)}
        sending={false}
        disabled={creating}
        placeholder="Ask across all your documents…"
      />
    </>
  );
};

export default NewChat;
