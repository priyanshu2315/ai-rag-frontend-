import { useState } from 'react';
import { isPrecedenceItem, referenceTags, referenceDefinitionLabel } from '../../utils/crossReferences';

const ReferenceDetails = ({ chunk, onReference }) => {
  const [selected, setSelected] = useState(null);
  const metadata = chunk.metadata ?? {};
  const tags = referenceTags(metadata);
  return <div className="mt-2 space-y-2 text-[12px] text-ink-2">
    {referenceDefinitionLabel(chunk) && <p className="text-amber-700 dark:text-amber-300">{referenceDefinitionLabel(chunk)}</p>}
    {metadata.isDocumentBoundary === true && <p className="rounded-(--radius-sm) border border-amber-400/40 p-2" title="Start of a standalone attachment or sub-document">Document boundary: {metadata.boundaryTitle ?? 'Title unavailable'}</p>}
    {metadata.is_toc === true && <span className="inline-flex rounded-full border border-border bg-surface-2 px-2 py-0.5" title="Table of Contents (automatically excluded from factual search to prevent noise)">TOC</span>}
    {isPrecedenceItem(chunk) && <p className="text-amber-700 dark:text-amber-300" title="Document role suggests reviewing precedence; an override is not established by this badge.">⚠️ Restatement / Precedence Item</p>}
    {tags.length > 0 && <><p className="font-semibold">Cross-References Found in Chunk</p><div className="flex flex-wrap gap-1">{tags.map((reference) => <button key={reference} type="button" aria-pressed={selected === reference}
      onClick={() => { setSelected(reference); onReference?.(reference, chunk); }} className="rounded-full border border-amber-400/40 bg-amber-50 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">🔗 {reference}</button>)}</div>
      {selected && <p role="status">Selected reference: {selected}{!onReference && ' · Target context is available in the search evidence when this reference is followed.'}</p>}</>}
    {Array.isArray(metadata.relationships) && metadata.relationships.some((relation) => relation?.from_page != null || relation?.to_page != null) && <div><p className="font-semibold">Relationships</p>{metadata.relationships.filter((relation) => relation && (relation.from_page != null || relation.to_page != null)).map((relation, index) => <p key={index}>
      {relation.type === 'table_continuation' ? 'Table continuation' : relation.type ?? 'Relationship'}{relation.from_page != null ? ` · Continued from Page ${relation.from_page}` : ''}{relation.to_page != null ? ` → Page ${relation.to_page}` : ''}{relation.table_id ? ` (${relation.table_id})` : ''}
    </p>)}</div>}
  </div>;
};
export default ReferenceDetails;
