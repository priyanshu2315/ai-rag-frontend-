import { useEffect, useRef } from 'react';
import { citationFromChunk, uniqueSources } from '../../utils/chatSources';
import CitationTooltip, { citationPillLabel } from './CitationTooltip';
import RetrievalOrigin from './RetrievalOrigin';
import { originStyle } from '../../utils/retrievalOrigin';
import ReferenceDetails from '../chunks/ReferenceDetails';
import { enrichReferenceCitation, followedReferences, referenceSelection } from '../../utils/crossReferences';
import Markdown from './Markdown';
import { JsonDetails } from '../chunks/ChunkInspection';

export const StreamCitationBadge = ({ citation, onOpen, describedBy }) => <button type="button"
  onClick={() => onOpen(citation)} aria-label={`Open source: ${citation.displayLabel ?? citation.sourceId}`}
  aria-describedby={describedBy}
  className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium hover:bg-surface-2 ${originStyle(citation.retrievalOrigin ?? { type: 'search' })}`}>
  {citationPillLabel(citation)}
</button>;

const AnswerSources = ({ citations = [], chunks = [], count, onOpen, final = false, selected = [], onSelect, referenceStatus }) => {
  const inspector = useRef(null);
  useEffect(() => { if (selected.length) inspector.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }, [selected]);
  if (!citations.length && !chunks.length && count == null) return null;
  return <section className="mt-3 space-y-2 border-t border-border pt-3 text-[12px] text-ink-2" aria-label="Answer sources">
    {citations.length > 0 && <>
      <p className="font-semibold">Sources</p>
      <div className="flex flex-wrap gap-1.5">{uniqueSources(citations).map((citation, index) =>
        <CitationTooltip key={index} citation={citation} onOpen={onOpen}>{(id) => <StreamCitationBadge citation={citation} onOpen={onOpen} describedBy={id} />}</CitationTooltip>)}</div>
    </>}
    {(chunks.length > 0 || count != null) && <details ref={inspector} open={selected.length > 0 || undefined}>
      <summary className="cursor-pointer font-medium">Evidence Chunks · {final ? chunks.length : count ?? chunks.length}{!final && count != null && count !== chunks.length ? ` (${chunks.length} observed across searches)` : ''}</summary>
      <p className="mt-2 text-muted">{selected.length ? 'Selected reference path and observed retrieval context.' : final ? 'Final accumulated generation evidence, in the server’s reading order.' : 'Retrieved evidence before final grading.'}</p>
      {selected.length > 0 && onSelect && <button type="button" className="text-blue hover:underline" onClick={() => onSelect([], null)}>Clear reference selection</button>}
      {referenceStatus && <p role="status">{referenceStatus}</p>}
      <ul className="mt-2 space-y-2">{uniqueSources(chunks).map((chunk) => <li key={chunk.id} data-selected={selected.includes(JSON.stringify([chunk.documentId, chunk.id])) || undefined} className={`rounded-(--radius-sm) border bg-surface-2 p-3 ${selected.includes(JSON.stringify([chunk.documentId, chunk.id])) ? 'border-amber-400 ring-2 ring-amber-400/40' : 'border-border'}`}>
        <StreamCitationBadge citation={enrichReferenceCitation(citationFromChunk(chunk), chunks)} onOpen={onOpen} />
        <div className="mt-2 flex flex-wrap gap-1"><RetrievalOrigin origin={chunk.retrievalOrigin} />
          <span className="rounded-full border border-border px-2 py-0.5">Page {(chunk.sourcePages?.length ? chunk.sourcePages : [chunk.pageNumber]).filter((page) => page != null).join('–') || 'Unavailable'}</span>
        </div>
        {chunk.headingPath?.length > 0 && <p className="mt-2 font-medium">{chunk.headingPath.join(' › ')}</p>}
        <ReferenceDetails chunk={chunk} onReference={(reference) => {
          const links = followedReferences(chunks).filter((link) => link.reference === reference && link.seed?.id === chunk.id && link.seed?.documentId === chunk.documentId);
          onSelect?.(links.flatMap(referenceSelection), links.length ? `Connected evidence for ${reference}` : `No followed target supplied for ${reference}`);
        }} />
        <div className="mt-2"><Markdown>{chunk.text ?? 'Passage unavailable'}</Markdown></div>
        {chunk.searchText && <details className="mt-2"><summary className="cursor-pointer">Contextual search text</summary><pre className="mt-1 whitespace-pre-wrap break-words">{chunk.searchText}</pre></details>}
        <JsonDetails title="Exact evidence record" value={chunk} />
      </li>)}</ul>
    </details>}
  </section>;
};

export default AnswerSources;
