import { Loader2 } from 'lucide-react';
import ChunkText from './ChunkText';
import ChunkMeta from './ChunkMeta';
import { MESSAGES } from '../../constants/messages';

/**
 * The children of one expanded parent — every state it can be in, since the
 * row is the only place the user finds out what happened (§12).
 *
 * `entry` is undefined until the fetch is dispatched, which is a beat of the
 * same wait as `loading`.
 */
const ChildChunkList = ({ entry, onRetry }) => {
  if (!entry || entry.loading) {
    return (
      <p className="flex items-center gap-2 py-1 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue" />
        Loading child chunks…
      </p>
    );
  }

  if (entry.notFound) {
    return <p className="py-1 text-[12px] text-muted">{MESSAGES.NO_CHILD_CHUNKS}</p>;
  }

  if (entry.error) {
    return (
      <p className="flex flex-wrap items-center gap-2 py-1 text-[12px] text-red">
        {entry.error}
        <button type="button" onClick={onRetry} className="font-medium text-blue hover:underline">
          Try again
        </button>
      </p>
    );
  }

  if (entry.items.length === 0) {
    return <p className="py-1 text-[12px] text-muted">{MESSAGES.NO_CHILD_CHUNKS}</p>;
  }

  return (
    <ol className="space-y-2">
      {entry.items.map((child, index) => (
        <li
          key={child.id}
          className="rounded-(--radius-sm) border border-border bg-surface-2 p-3"
        >
          <div className="flex items-center gap-2">
            <span className="mono shrink-0 rounded-(--radius-sm) bg-purple-bg px-1.5 py-0.5 text-[10px] font-semibold text-purple">
              C{index + 1}
            </span>
            <span className="mono min-w-0 flex-1 truncate text-[10.5px] text-muted-2" title={child.id}>
              {child.id}
            </span>
            <ChunkMeta metadata={child.metadata} className="flex shrink-0 flex-wrap gap-1.5" />
          </div>

          <ChunkText text={child.text} className="mt-2 text-[12.5px] text-ink-2" />
        </li>
      ))}
    </ol>
  );
};

export default ChildChunkList;
