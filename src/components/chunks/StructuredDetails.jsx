import { JsonDetails } from './ChunkInspection';

export const EvidenceFields = ({ value }) => value && (
  <dl className="mt-2 space-y-2 break-words text-[12px] text-ink-2">
    {Object.entries(value).map(([key, item]) => <div key={key}>
      <dt className="font-semibold text-muted">{key.replace(/_/g, ' ')}</dt>
      <dd className="whitespace-pre-wrap">{item == null ? 'Unavailable' : typeof item === 'object'
        ? <JsonDetails title={Array.isArray(item) ? `${item.length} entries · view evidence` : 'View details'} value={item} />
        : String(item)}</dd>
    </div>)}
  </dl>
);

export const Relationships = ({ references = [], relationships = [], onNavigate, parentById }) => (
  <div className="mt-3 space-y-2 text-[12px] text-muted">
    {references.map((reference, index) => <div key={`ref-${index}`}>
      <strong>{reference.relation}: {reference.targetLabel}</strong> · {reference.status}
      <p>{reference.reason} {reference.evidence?.text}</p>
      {(reference.targetParentIds ?? []).map((id) => <button key={id} type="button"
        disabled={!parentById?.has(id)} onClick={() => onNavigate?.(id)}
        className="mr-2 text-blue disabled:text-muted">Go to {id} ({reference.status})</button>)}
      <JsonDetails title="Reference evidence" value={reference} />
    </div>)}
    {relationships.map((relation, index) => <div key={`table-${index}`}>
      <strong>Table continuation: {relation.tableId ?? relation.candidateTableIds?.join(', ') ?? 'Unknown'}</strong> · {relation.status}
      <p>{relation.reason ?? relation.evidence?.join(' · ')}</p>
      {parentById && [...parentById.values()].filter((parent) =>
        (parent.metadata?.table_ids ?? []).includes(relation.tableId)).map((parent) =>
        <button key={parent.id} type="button" onClick={() => onNavigate?.(parent.id)} className="mr-2 text-blue">Go to {parent.id} ({relation.status})</button>)}
      <JsonDetails title="Continuation evidence" value={relation} />
    </div>)}
  </div>
);

const StructuredDetails = ({ chunk }) => {
  const metadata = chunk.metadata ?? {};
  const fields = ['chunker_version', 'heading_path', 'source_pages', 'source', 'section_structure',
    'reading_section_ids', 'block_ids', 'source_unit_ids', 'block_types', 'table_ids', 'row_ids',
    'list_item_ids', 'contains_unit_fragments', 'context_compacted', 'structure_warnings', 'token_budget'];
  return <div className="mt-3 rounded-(--radius-sm) border border-border p-3 text-[11px] text-muted">
    <p className="font-semibold">Structure and contextual token budget</p>
    <p>Counts include contextual input and special tokens. Parent budgets describe context; parents are not embedded.</p>
    <EvidenceFields value={Object.fromEntries(fields.filter((key) => metadata[key] !== undefined).map((key) => [key, metadata[key]]))} />
    <Relationships references={metadata.references} relationships={metadata.relationships} />
    <JsonDetails title="Passage evidence locations" value={metadata.source_locations ?? null} />
    <JsonDetails title="Supporting headers, notes and definitions" value={metadata.context_locations ?? null} />
    <p>Offsets use UTF-16, start inclusive and end exclusive. A source_unit span can cover more than a split child.</p>
    {metadata.document_identity && <details><summary className="cursor-pointer">Document identity · {metadata.document_identity.title} · {metadata.document_identity.status}</summary><EvidenceFields value={metadata.document_identity} /></details>}
  </div>;
};
export default StructuredDetails;
