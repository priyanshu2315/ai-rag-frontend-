import { useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import ChunkInspection, { JsonDetails } from './ChunkInspection';
import EmbeddingInspection from './EmbeddingInspection';
import CopyButton from '../buttons/CopyButton';
import { MESSAGES } from '../../constants/messages';
import { sortByMetadataIndex } from '../../utils/chunkInspector';

/**
 * The children of one expanded parent — every state it can be in, since the
 * row is the only place the user finds out what happened (§12).
 *
 * `entry` is undefined until the fetch is dispatched, which is a beat of the
 * same wait as `loading`.
 */
const ChildChunkList = ({ entry, onRetry }) => {
  const [limit, setLimit] = useState(60);
  const [openChildren, setOpenChildren] = useState(() => new Set());
  if (!entry || entry.loading) {
    return (
      <p className="flex items-center gap-2 py-1 text-[12px] text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-blue" />
        Loading child chunks…
      </p>
    );
  }

  if (entry.notFound) {
    return <p className="py-1 text-[12px] text-muted">This parent is unavailable or you do not have access to it.</p>;
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
    <>
    <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-muted">
      <span>{entry.items.length} loaded / {entry.totalChildren ?? 'unknown'} total</span>
      {openChildren.size > 0 && (
        <button type="button" onClick={() => setOpenChildren(new Set())} className="font-medium text-blue hover:underline">
          Close child chunks
        </button>
      )}
    </div>
    <ol className="space-y-2">
      {sortByMetadataIndex(entry.items, 'child_index').slice(0, limit).map((child, index) => (
        <li
          key={child.id}
          className="rounded-(--radius-sm) border border-border bg-surface-2 p-3"
        >
          <details
            className="group"
            open={openChildren.has(child.id)}
            onToggle={(event) => {
              const isOpen = event.currentTarget?.open;
              setOpenChildren((current) => {
                const next = new Set(current);
                if (isOpen) next.add(child.id);
                else next.delete(child.id);
                return next;
              });
            }}
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-2 transition-transform group-open:rotate-90" />
              <span className="mono shrink-0 rounded-(--radius-sm) bg-purple-bg px-1.5 py-0.5 text-[10px] font-semibold text-purple">
                C{index + 1}
              </span>
              <span className="mono min-w-0 flex-1 truncate text-[10.5px] text-muted-2" title={child.id}>
                {child.id}
              </span>
              <span className="text-[11px] text-muted">Index {child.metadata?.child_index ?? 'unavailable'}</span>
              <span className="text-[11px] text-muted">Page {child.metadata?.page_number ?? 'unavailable'}</span>
            </summary>
            <p className="mt-3 text-[11px] text-muted">Child ID: <span className="mono break-all">{child.id}</span> <CopyButton text={child.id} label="Copy child ID" /></p>
            <p className="mt-1 text-[11px] text-muted">Parent ID: <span className="mono break-all">{child.parentId ?? 'Unavailable'}</span></p>
            <ChunkInspection chunk={child} />
            <EmbeddingInspection child={child} />
          </details>
        </li>
      ))}
    </ol>
    {entry.items.length > limit && <button type="button" onClick={() => setLimit((value) => value + 60)} className="text-[12px] text-blue">Show more children</button>}
    <JsonDetails className="mt-3 text-[11px] text-muted" title="Exact child endpoint data" value={entry.response ?? null} />
    </>
  );
};

export default ChildChunkList;
