import { memo, useCallback, useMemo } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import cn from '../../utils/cn';
import { toSingleLine } from '../../utils/format';
import ChunkInspection from './ChunkInspection';
import ChildChunkList from './ChildChunkList';
import CopyButton from '../buttons/CopyButton';

const LinkField = ({ label, value, available, target, sectionId, onNavigate }) => (
  <div className="min-w-0 text-[11px] text-muted">
    <span className="font-medium text-ink-2">{label}: </span>
    {!available ? 'Unavailable from API' : value === null ? 'None' : <>
      {target ? (
        <button type="button" onClick={() => onNavigate(value)} className="mono break-all text-blue hover:underline" title={`Go to parent ${value}`}>
          {value}
        </button>
      ) : <span className="mono break-all">{value}</span>}
      {!target && <span> (not in returned parent list)</span>}
      {target && sectionId != null && target.metadata?.section_id != null && target.metadata.section_id !== sectionId && <span className="text-red"> (different section)</span>}
    </>}
  </div>
);

const ParentChunkRow = memo(({ chunk, index, open, entry, onToggle, onRetry, onNavigate, parentById }) => {
  const toggle = useCallback(() => onToggle(chunk.id), [onToggle, chunk.id]);
  const retry = useCallback(() => onRetry(chunk.id), [onRetry, chunk.id]);
  const preview = useMemo(() => toSingleLine(chunk.text), [chunk.text]);
  const metadata = chunk.metadata ?? {};

  return (
    <li id={`parent-${chunk.id}`} className="overflow-hidden rounded-(--radius) border border-border bg-surface shadow-(--sh-sm)">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-surface-2"
      >
        <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-2 transition-transform', open && 'rotate-90 text-blue')} />
        <span className="mono shrink-0 rounded-(--radius-sm) bg-blue-lt px-1.5 py-0.5 text-[10px] font-semibold text-blue">
          P{index + 1}
        </span>
        <span className={cn('min-w-0 flex-1 text-[13px] text-ink-2', !open && 'truncate')}>
          {open ? <span className="mono break-all text-[10.5px] text-muted-2">{chunk.id}</span> : preview}
        </span>
        {metadata.page_number != null && <span className="shrink-0 text-[11px] text-muted">Page {metadata.page_number}</span>}
        {entry?.loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue" />}
      </button>

      {open && (
        <div className="border-t border-border p-3.5">
          <dl className="grid gap-x-5 gap-y-1 text-[11px] text-muted sm:grid-cols-2">
            <div><dt className="inline font-medium text-ink-2">Parent ID: </dt><dd className="mono inline break-all">{chunk.id}</dd> <CopyButton text={chunk.id} label="Copy parent ID" /></div>
            <div><dt className="inline font-medium text-ink-2">Section: </dt><dd className="mono inline break-all">{metadata.section_id ?? 'Unavailable'}</dd></div>
            <div><dt className="inline font-medium text-ink-2">Page: </dt><dd className="inline">{metadata.page_number ?? 'Unavailable'}</dd></div>
            <div><dt className="inline font-medium text-ink-2">Global chunk index: </dt><dd className="inline">{metadata.chunk_index ?? 'Unavailable'}</dd></div>
            <div><dt className="inline font-medium text-ink-2">Section part index: </dt><dd className="inline">{metadata.section_part_index ?? 'Unavailable'}</dd></div>
            <div><dt className="inline font-medium text-ink-2">Children: </dt><dd className="inline">{entry?.items?.length ?? 0} loaded / {entry?.totalChildren ?? chunk.totalChildren ?? 'unknown'} total</dd></div>
          </dl>
          <div className="mt-2 grid gap-x-5 gap-y-1 sm:grid-cols-2">
            <LinkField label="Previous parent" value={chunk.prevParentId} available={Object.hasOwn(chunk, 'prevParentId') && chunk.prevParentId !== undefined} target={parentById.get(chunk.prevParentId)} sectionId={metadata.section_id} onNavigate={onNavigate} />
            <LinkField label="Next parent" value={chunk.nextParentId} available={Object.hasOwn(chunk, 'nextParentId') && chunk.nextParentId !== undefined} target={parentById.get(chunk.nextParentId)} sectionId={metadata.section_id} onNavigate={onNavigate} />
          </div>
          <ChunkInspection chunk={chunk} />
          <h4 className="mt-5 text-[11px] font-semibold uppercase tracking-wider text-muted-2">Children</h4>
          <div className="mt-2 border-l-2 border-border-2 pl-3">
            <ChildChunkList entry={entry} onRetry={retry} />
          </div>
        </div>
      )}
    </li>
  );
});

ParentChunkRow.displayName = 'ParentChunkRow';

export default ParentChunkRow;
