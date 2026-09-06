import { memo, useCallback, useMemo } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import cn from '../../utils/cn';
import { toSingleLine } from '../../utils/format';
import ChunkText from './ChunkText';
import ChunkMeta from './ChunkMeta';
import ChildChunkList from './ChildChunkList';

/** The count only exists once the children have been fetched at least once. */
const childCountLabel = (entry) => {
  if (!entry || entry.loading) return null;
  if (entry.notFound || entry.error) return null;
  return entry.items.length === 1 ? '1 child' : `${entry.items.length} children`;
};

/**
 * One collapsible parent chunk. Memoised because expanding any row re-renders
 * the list, and the rows that did not change should not re-render with it.
 */
const ParentChunkRow = memo(({ chunk, index, open, entry, onToggle, onRetry }) => {
  const toggle = useCallback(() => onToggle(chunk.id), [onToggle, chunk.id]);
  const retry = useCallback(() => onRetry(chunk.id), [onRetry, chunk.id]);

  const preview = useMemo(() => toSingleLine(chunk.text), [chunk.text]);
  const count = childCountLabel(entry);

  // The page is the one piece of metadata worth reading before opening a row —
  // it is how someone finds the passage in the actual document.
  const page = chunk.metadata?.page_number;

  return (
    <li className="overflow-hidden rounded-(--radius) border border-border bg-surface shadow-(--sh-sm)">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-2"
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 text-muted-2 transition-transform',
            open && 'rotate-90 text-blue'
          )}
        />

        <span className="mono shrink-0 rounded-(--radius-sm) bg-blue-lt px-1.5 py-0.5 text-[10px] font-semibold text-blue">
          P{index + 1}
        </span>

        {page !== undefined && (
          <span className="hidden shrink-0 rounded-(--radius-sm) border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted sm:inline">
            Page {page}
          </span>
        )}

        <span className={cn('min-w-0 flex-1 text-[13px] text-ink-2', !open && 'truncate')}>
          {open ? <span className="mono text-[10.5px] text-muted-2">{chunk.id}</span> : preview}
        </span>

        {open && entry?.loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue" />}

        {count && (
          <span className="hidden shrink-0 text-[11px] text-muted sm:inline">{count}</span>
        )}
      </button>

      {open && (
        <div className="border-t border-border p-3.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">
              Parent text
            </p>
            <ChunkMeta metadata={chunk.metadata} className="flex flex-wrap gap-1.5" />
          </div>

          <ChunkText text={chunk.text} className="mt-1.5 text-[13px] text-ink-2" />

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
            Child chunks
          </p>
          <div className="mt-1.5 border-l-2 border-border-2 pl-3">
            <ChildChunkList entry={entry} onRetry={retry} />
          </div>
        </div>
      )}
    </li>
  );
});

ParentChunkRow.displayName = 'ParentChunkRow';

export default ParentChunkRow;
