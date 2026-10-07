import { useState } from 'react';
import CopyButton from '../buttons/CopyButton';

const Field = ({ label, value }) => (
  <span><strong className="text-ink-2">{label}:</strong> {value ?? 'Unavailable'}</span>
);

const EmbeddingInspection = ({ child }) => {
  const [vectorOpen, setVectorOpen] = useState(false);
  const diagnostic = child.embeddingDetails ?? child.metadata?.embedding ?? {};
  const vector = Array.isArray(child.embedding) ? child.embedding : null;
  return (
    <div className="mt-3 rounded-(--radius-sm) border border-border bg-surface p-3 text-[11px] text-muted">
      <p className="font-semibold uppercase tracking-wider text-muted-2">Embedding</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Field label="Model" value={diagnostic.model} />
        <Field label="Tokens" value={diagnostic.tokenCount} />
        <Field label="Token limit" value={diagnostic.tokenLimit} />
        <Field label="Within limit" value={diagnostic.withinLimit == null ? null : String(diagnostic.withinLimit)} />
        <Field label="Reported dimensions" value={child.embeddingDimensions ?? diagnostic.dimensions} />
        <Field label="Stored vector length" value={vector?.length} />
      </div>
      {child.embeddingStage && <p className="mt-2">Stage: {child.embeddingStage}</p>}
      {child.embeddingError && <p className="mt-1 text-red">{child.embeddingError}</p>}
      {vector ? (
        <details className="mt-3" onToggle={(event) => setVectorOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer font-medium text-blue">Full stored vector ({vector.length} values)</summary>
          <div className="mt-2 flex justify-end"><CopyButton text={JSON.stringify(vector)} label="Copy vector" /></div>
          {vectorOpen && <ol className="mono mt-2 grid max-h-64 grid-cols-1 gap-x-4 overflow-auto rounded-(--radius-sm) bg-surface-2 p-3 sm:grid-cols-2">
            {vector.map((value, index) => <li key={index} className="flex gap-2"><span className="w-8 text-muted-2">{index}</span><span className="break-all text-ink-2">{String(value)}</span></li>)}
          </ol>}
        </details>
      ) : <p className="mt-2">Stored vector unavailable in this response.</p>}
    </div>
  );
};

export default EmbeddingInspection;
