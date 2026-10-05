import { useState } from 'react';
import CopyButton from '../buttons/CopyButton';

const JsonView = ({ value }) => (
  <pre className="mt-2 max-h-72 overflow-auto rounded-(--radius-sm) bg-surface-2 p-3 text-[11px] leading-relaxed text-ink-2">
    {JSON.stringify(value, null, 2)}
  </pre>
);

const JsonDetails = ({ title, value, className }) => {
  const [open, setOpen] = useState(false);
  return (
    <details className={className} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer font-medium hover:text-ink">{title}</summary>
      {open && <JsonView value={value} />}
    </details>
  );
};

/** Show the stored fields exactly as returned; never synthesize search text. */
const ChunkInspection = ({ chunk }) => (
  <>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div className="min-w-0 rounded-(--radius-sm) border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Raw passage</p><CopyButton text={chunk.text ?? ''} label="Copy raw passage" /></div>
        <pre className="mono overflow-x-auto whitespace-pre text-[12px] leading-relaxed text-ink-2">
          {chunk.text ?? 'No passage returned.'}
        </pre>
      </div>
      <div className="min-w-0 rounded-(--radius-sm) border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Stored contextual search text</p>{typeof chunk.searchText === 'string' && <CopyButton text={chunk.searchText} label="Copy contextual text" />}</div>
        {typeof chunk.searchText === 'string' ? (
          <pre className="mono overflow-x-auto whitespace-pre text-[12px] leading-relaxed text-ink-2">
            {chunk.searchText}
          </pre>
        ) : (
          <p className="text-[12px] text-muted">Unavailable from this API response.</p>
        )}
      </div>
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
      <JsonDetails title="Metadata" value={chunk.metadata ?? null} />
      <JsonDetails title="Exact returned record" value={chunk} />
    </div>
  </>
);

export { JsonDetails };
export default ChunkInspection;
