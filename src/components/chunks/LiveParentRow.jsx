import { useState } from 'react';
import ChunkInspection from './ChunkInspection';
import EmbeddingInspection from './EmbeddingInspection';

const LiveParentRow = ({ parent }) => {
  const [limit, setLimit] = useState(60);
  return (
  <li id={`parent-${parent.id}`} className="rounded-(--radius-sm) border border-border bg-surface-2 p-3">
    <details>
      <summary className="cursor-pointer text-[12px] font-medium text-ink-2">
        Prepared parent <span className="mono break-all">{parent.id}</span> · page {parent.metadata?.page_number ?? 'unknown'} · {parent.children.length} children seen
      </summary>
      <p className="mt-3 text-[11px] text-muted">In-memory preparation only. Saved records become authoritative after chunks_saved.</p>
      <p className="mt-1 text-[11px] text-muted">Previous: {parent.prevParentId === undefined ? 'pending or unavailable' : parent.prevParentId ?? 'none'} · Next: {parent.nextParentId === undefined ? 'pending or unavailable' : parent.nextParentId ?? 'none'}</p>
      <ChunkInspection chunk={parent} />
      <ul className="mt-3 space-y-2">
        {parent.children.slice(0, limit).map((child) => (
          <li key={child.id} className="rounded-(--radius-sm) border border-border bg-surface p-3">
            <details>
              <summary className="cursor-pointer text-[11px] font-medium text-ink-2">Prepared child <span className="mono break-all">{child.id}</span> · index {child.metadata?.child_index ?? 'unknown'}</summary>
              <ChunkInspection chunk={child} />
              <EmbeddingInspection child={child} />
            </details>
          </li>
        ))}
      </ul>
      {parent.children.length > limit && <button type="button" onClick={() => setLimit((value) => value + 60)} className="text-blue">Show more children</button>}
    </details>
  </li>
  );
};

export default LiveParentRow;
