import { useState } from 'react';
import StructuredDetails from './StructuredDetails';
import CopyButton from '../buttons/CopyButton';
import Markdown from '../chat/Markdown';
import ReferenceDetails from './ReferenceDetails';

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
    <ReferenceDetails chunk={chunk} />
    <div className="mt-3 space-y-1 break-words text-[12px] text-muted">
      {chunk.metadata?.document_title && <p className="font-semibold text-ink-2">{chunk.metadata.document_title}</p>}
      {chunk.metadata?.heading_path?.length > 0 && <p>{chunk.metadata.heading_path.join(' › ')}</p>}
      {chunk.metadata?.source_pages?.length > 0 && <p>Source pages: {chunk.metadata.source_pages.join(', ')}</p>}
      {chunk.metadata?.chunker_version && <p>Chunker: {chunk.metadata.chunker_version}</p>}
    </div>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div className="min-w-0 rounded-(--radius-sm) border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Rendered passage</p><CopyButton text={chunk.text ?? ''} label="Copy raw passage" /></div>
        <div className="text-[12px] leading-relaxed text-ink-2"><Markdown>
          {chunk.text ?? 'No passage returned.'}
        </Markdown></div>
      </div>
      <div className="min-w-0 rounded-(--radius-sm) border border-border bg-surface-2 p-3">
        <div className="mb-2 flex items-center justify-between gap-2"><p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Contextual search input</p>{typeof chunk.searchText === 'string' && <CopyButton text={chunk.searchText} label="Copy contextual text" />}</div>
        {typeof chunk.searchText === 'string' ? (
          <pre className="mono overflow-x-auto whitespace-pre text-[12px] leading-relaxed text-ink-2">
            {chunk.searchText}
          </pre>
        ) : (
          <p className="text-[12px] text-muted">Unavailable from this API response.</p>
        )}
      </div>
    </div>
    <StructuredDetails chunk={chunk} />
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
      <JsonDetails title="Metadata" value={chunk.metadata ?? null} />
      <JsonDetails title="Exact returned record" value={chunk} />
    </div>
  </>
);

export { JsonDetails };
export default ChunkInspection;
