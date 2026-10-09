import { useMemo, useState } from 'react';
import { EvidenceFields, Relationships } from '../chunks/StructuredDetails';
import { JsonDetails } from '../chunks/ChunkInspection';
import { headingTree, structureGroups, uniqueEvidence } from '../../utils/structuredInspector';

const Heading = ({ node }) => <li className="mt-2 border-l border-border pl-3">
  <details><summary className="cursor-pointer">{node.title} · {node.status} · depth {node.depth ?? 'Unavailable'} · {node.role}</summary>
    <EvidenceFields value={Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'children'))} />
  </details>
  {node.children.length > 0 && <ul>{node.children.map((child) => <Heading key={child.id} node={child} />)}</ul>}
</li>;

const StructureOverview = ({ structure, parents, persistedParents = [], childEntries, documentId, onNavigate, parentById, progress, status, summaryStatus }) => {
  const [limit, setLimit] = useState(40);
  const chunks = useMemo(() => [...parents, ...Object.values(childEntries).flatMap((entry) => entry.items ?? [])], [parents, childEntries]);
  const identity = parents.find((parent) => parent.metadata?.document_identity)?.metadata.document_identity ?? structure.identity;
  const tree = useMemo(() => headingTree(Object.values(structure.headings).slice(0, limit)), [structure.headings, limit]);
  const relationships = uniqueEvidence([...structure.relationships, ...chunks.flatMap((chunk) => chunk.metadata?.relationships ?? [])]);
  const references = uniqueEvidence([...structure.references, ...chunks.flatMap((chunk) => chunk.metadata?.references ?? [])]);
  const warnings = [...new Set([...structure.warnings, ...(identity?.warnings ?? []),
    ...Object.values(structure.sources).flatMap((source) => source.source?.warnings ?? []),
    ...Object.values(structure.headings).flatMap((heading) => heading.warnings ?? []),
    ...Object.values(structure.sections).flatMap((section) => section.structure?.boundary?.warnings ?? []),
    ...chunks.flatMap((chunk) => [...(chunk.metadata?.structure_warnings ?? []), ...(chunk.metadata?.extraction?.warnings ?? []), ...(chunk.metadata?.document_identity?.warnings ?? []), ...(chunk.metadata?.section_structure?.boundary?.warnings ?? [])])])];
  const tables = structureGroups(chunks, documentId, 'table_ids');
  const lists = structureGroups(chunks, documentId, 'list_item_ids');
  return <section className="mt-5 rounded-(--radius) border border-border bg-surface p-4 text-[12px] text-muted">
    <h3 className="font-display font-semibold text-ink">Structured ingestion</h3>
    <p>Chunker: {parents.find((parent) => parent.metadata?.chunker_version)?.metadata.chunker_version ?? structure.chunkerVersion ?? 'Unavailable for this document'}</p>
    <p>Provider: {structure.provider ?? 'Unavailable'} · Operation: {structure.usage?.operation ?? 'Unavailable'} · Model: {structure.usage?.model ?? 'Unavailable'}</p>
    {structure.chunkerVersion === 'ai-corrected-markdown-v1' ? <p>Gemini-derived Markdown is chunked locally, and children are embedded locally. AI-extracted or AI-corrected status describes processing and does not verify factual accuracy.</p>
      : <p>This document uses its stored chunker metadata. Older documents can expose different heading, section-part, relationship, and reference fields.</p>}
    <p>Ingestion: {status ?? 'Checking'} · Phase: {progress?.phase ?? 'Unavailable'} · Summary: {summaryStatus ?? structure.summary} · Connection: {progress?.connection ?? 'Not connected'}</p>
    <p>Sources: {structure.totalSources ?? 'Unknown'} · Physical pages: {structure.totalPages ?? 'Unknown'} · Prepared parents: {Object.keys(structure.parents).length} · Prepared children: {Object.keys(structure.children).length} · Embedded children: {Object.values(structure.children).filter((child) => child.embeddingStage === 'embedded in memory').length}</p>
    <p>Saved parents: {persistedParents.length || (structure.saved ? structure.savedCounts?.parents ?? 'Awaiting REST' : 'Not saved yet')} · Saved children: {structure.savedCounts?.children ?? (persistedParents.length && persistedParents.every((parent) => parent.totalChildren != null) ? persistedParents.reduce((sum, parent) => sum + parent.totalChildren, 0) : 'Unknown')}</p>
    <p>Provenance: saved REST chunks and events captured in this session. Live history is partial; early events can be missed. The backend provides no replay.</p>
    <p>Original extraction: {Object.keys(structure.sources).length ? 'Client-captured sources available' : 'Unavailable after refresh or missed live connection'} · Heading event history: {tree.length ? 'Client-captured decisions available' : 'Unavailable after refresh or not emitted'} · Section-part history: {Object.keys(structure.parts).length ? 'Client-captured parts available' : 'Unavailable after refresh or not emitted'}.</p>
    <details className="mt-3"><summary className="cursor-pointer">Document identity · {identity?.title ?? 'Unavailable'} · {identity?.status ?? 'Unknown'}</summary>
      <p>Title source: {identity?.titleSource ?? 'Unavailable'}. Inferred or AI-derived identity is not externally verified.</p><EvidenceFields value={identity} />
    </details>
    <details className="mt-3"><summary className="cursor-pointer">AI Markdown blocks · {Object.keys(structure.blocks ?? {}).length}</summary>
      <p>Block locations can cover whole Markdown blocks and do not promise pixel-perfect fragment highlighting.</p>
      {Object.values(structure.blocks ?? {}).slice(0, limit).map((block) => <div key={block.blockId} className="mt-2 border-l border-border pl-3"><p>{block.blockType} · {block.headingPath?.join(' > ') || 'Document prelude'} · page {block.page ?? 'Unavailable'}</p><pre className="max-h-52 overflow-auto whitespace-pre-wrap">{block.text}</pre><JsonDetails title="Raw block event" value={block} /></div>)}
    </details>
    <details className="mt-3"><summary className="cursor-pointer">Heading decisions · {Object.keys(structure.headings).length}</summary>
      <p>Hierarchy follows parent candidate IDs. Missing and unresolved candidates remain visible.</p><ul>{tree.slice(0, limit).map((node) => <Heading key={node.id} node={node} />)}</ul>
    </details>
    <details className="mt-3"><summary className="cursor-pointer">Warnings · {warnings.length} · Unresolved relationships · {[...relationships, ...references].filter((item) => item.status === 'unresolved').length}</summary>
      <ul>{warnings.slice(0, limit).map((warning) => <li key={warning}>{warning}</li>)}</ul>
      <Relationships relationships={relationships.slice(0, limit)} references={references.slice(0, limit)} onNavigate={onNavigate} parentById={parentById} />
      <p>Relationship navigation does not imply backend search traverses these links; that is pending Part 2.</p>
    </details>
    <details className="mt-3"><summary className="cursor-pointer">Tables · {tables.length} · Unique list items in loaded scope · {lists.length}</summary>
      <p>IDs are scoped to this document. Rendered labelled values retain column labels, dates, units and definitions; no dedicated cell schema is supplied. Fragments retain the same row/item identities.</p>
      {[...tables, ...lists].slice(0, limit).map((group) => <details key={group.key}><summary className="cursor-pointer">{group.id} · {group.chunks.length} loaded passages</summary>
        {group.chunks.map((chunk) => <div key={chunk.id} className="mt-2 border-l border-border pl-3">
          <button type="button" className="text-blue" disabled={!parentById.has(chunk.parentId ?? chunk.id)} onClick={() => onNavigate(chunk.parentId ?? chunk.id)}>Go to parent {chunk.parentId ?? chunk.id}</button>
          <p>Owning section: {chunk.metadata?.section_id ?? 'Unavailable'} · Original reading placement: {chunk.metadata?.reading_section_ids?.join(', ') ?? 'Unavailable'} · Review: {String(chunk.metadata?.section_structure?.review_required ?? 'Unavailable')} · Fragment: {String(chunk.metadata?.contains_unit_fragments ?? false)}</p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap">{chunk.text}</pre>
          <JsonDetails title="Row, block, list IDs and supporting evidence" value={chunk.metadata} />
        </div>)}
      </details>)}
    </details>
    {structure.diagnostics.length > 0 && <div className="mt-3 text-red"><p>Specific processing diagnostics (full offending units may be unavailable)</p>{structure.diagnostics.map((event, index) => <div key={event.eventId ?? index}>{event.code}: {event.message}<JsonDetails title="Error details" value={event} /></div>)}</div>}
    {(tables.length + lists.length > limit || Object.keys(structure.headings).length > limit || warnings.length > limit || relationships.length > limit || references.length > limit) && <button type="button" onClick={() => setLimit((value) => value + 40)} className="mt-2 text-blue">Show more structure</button>}
  </section>;
};
export default StructureOverview;
