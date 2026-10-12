import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { configureStore } from '@reduxjs/toolkit';
import { observedChunks, enrichReferenceCitation, referenceSelection, referenceSeed, isPrecedenceItem, referenceDefinitionLabel } from '../src/utils/crossReferences.js';
import { findPdfPassageRanges } from '../src/utils/pdfPassage.js';
import { previewSource } from '../src/utils/chatSources.js';
import { summarizeTrace } from '../src/utils/crag.js';

const seed = { id: 'seed', documentId: 'doc', documentTitle: 'Handbook', pageNumber: 3, headingPath: ['Operating Costs'], metadata: { chunk_index: 2, references: ['Resolution 2025-14'] } };
const target = { id: 'target', documentId: 'doc', documentTitle: 'Handbook', pageNumber: 9, headingPath: ['Appendix B - Board Resolution Restatement'], text: 'Restated cost: 5,000',
  fileUrl: 'https://example.com/Handbook.pdf', retrievalOrigin: { type: 'reference_following', seedParentId: 'seed', reference: 'Resolution 2025-14' }, metadata: { chunk_index: 8 } };
const citation = { ...target, chunkId: target.id, sourceId: 'Page 9', displayLabel: 'Handbook, Page 9 (Appendix B)', snippet: target.text };
let vite, AnswerTimeline, AnswerSources, ReferenceFlow, ChunkInspection, CitationBadge, CitationTooltipContent, SourceContent, reducer, slice;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: AnswerTimeline } = await vite.ssrLoadModule('/src/components/chat/AnswerTimeline.jsx'));
  ({ default: AnswerSources } = await vite.ssrLoadModule('/src/components/chat/AnswerSources.jsx'));
  ({ default: ReferenceFlow } = await vite.ssrLoadModule('/src/components/chat/ReferenceFlow.jsx'));
  ({ default: ChunkInspection } = await vite.ssrLoadModule('/src/components/chunks/ChunkInspection.jsx'));
  ({ CitationBadge } = await vite.ssrLoadModule('/src/components/chat/Markdown.jsx'));
  ({ CitationTooltipContent } = await vite.ssrLoadModule('/src/components/chat/CitationTooltip.jsx'));
  ({ SourceContent } = await vite.ssrLoadModule('/src/components/chat/SourceDrawer.jsx'));
  slice = await vite.ssrLoadModule('/src/redux/slices/chatSlice.js');
  reducer = slice.default;
});
after(async () => vite?.close());

for (const type of ['neighbor_expansion', 'retrieved_chunks']) test(`${type} preserves reference origins and displays the reference path before advanced details`, () => {
  const store = configureStore({ reducer });
  store.dispatch(slice.answerStarted());
  store.dispatch(slice.answerGraphEvent({ type: 'retrieval_candidates', documents: [seed] }));
  store.dispatch(slice.answerGraphEvent({ type, documents: type === 'neighbor_expansion' ? [target] : undefined, chunks: type === 'retrieved_chunks' ? [target] : undefined, count: 1 }));
  const message = store.getState().messages.at(-1);
  const html = renderToStaticMarkup(createElement(AnswerTimeline, { steps: message.steps, streaming: true, onReferenceSelect: () => {} }));
  assert.match(html, /Followed Reference: Resolution 2025-14/);
  assert.match(html, /Page 3: Operating Costs/);
  assert.match(html, /Pulled: Page 9: Appendix B/);
  assert.equal(summarizeTrace(message.steps).counts.reference_following, 1);
});

test('clicking a reference path selects both exact records and opens highlighted evidence', () => {
  let selected;
  const flow = ReferenceFlow({ chunks: [seed, target], onSelect: (link) => { selected = referenceSelection(link); } });
  flow.props.children[0].props.onClick();
  assert.deepEqual(selected, ['["doc","seed"]', '["doc","target"]']);
  const html = renderToStaticMarkup(createElement(AnswerSources, { chunks: [seed, target], selected, onOpen: () => {} }));
  assert.match(html, /<details open="">/);
  assert.equal((html.match(/data-selected="true"/g) ?? []).length, 2);
});

test('each citation origin has a distinct icon, label and tooltip; reference clicks preserve seed context', () => {
  for (const [type, icon, label] of [['search', '📄', 'Direct Search Hit'], ['table_continuation', '▦', 'Table Continuation'], ['section_expansion', '§', 'Section Expansion'], ['reference_following', '🔗', 'Reference Followed: Resolution 2025-14']]) {
    const value = enrichReferenceCitation({ ...citation, retrievalOrigin: { ...target.retrievalOrigin, type } }, [seed, target]);
    let preview;
    const badge = CitationBadge({ citation: value, onCitation: (clicked) => { preview = previewSource(clicked, [seed, target]); } });
    assert.ok(renderToStaticMarkup(badge).includes(icon));
    const tooltip = renderToStaticMarkup(createElement(CitationTooltipContent, { citation: value, onOpen: () => {} }));
    assert.ok(tooltip.includes(label));
    assert.match(tooltip, /Handbook.pdf#page=9/);
    badge.props.onClick();
    assert.equal(preview.selection.pageNumber, 9);
    if (type === 'reference_following') {
      assert.match(preview.selection.referenceNotice, /Page 3: Operating Costs/);
      assert.match(renderToStaticMarkup(createElement(SourceContent, { citation: value, parent: target })), /Retrieved via cross-reference/);
    }
  }
});

test('chunk inspection shows interactive string references, TOC exclusions and page relationships alongside legacy objects', () => {
  const html = renderToStaticMarkup(createElement(ChunkInspection, { chunk: { ...target, metadata: {
    is_toc: true, references: ['§3.5', { relation: 'supports', targetLabel: 'Legacy Appendix', status: 'resolved' }], cross_references: ['Appendix B', '§3.5'],
    relationships: [{ type: 'table_continuation', table_id: 'table-1', from_page: 3, to_page: 4 }],
  } } }));
  assert.match(html, /<button[^>]*aria-pressed="false"[^>]*>🔗 §3.5<\/button>/);
  assert.match(html, /🔗 Appendix B/);
  assert.match(html, /TOC/);
  assert.match(html, /automatically excluded from factual search/);
  assert.match(html, /Continued from Page 3 → Page 4 \(table-1\)/);
  assert.match(html, /Restatement \/ Precedence Item/);
  assert.match(html, /Legacy Appendix/);
});

test('seed resolution never crosses known documents and missing context stays explicit', () => {
  assert.equal(referenceSeed(target.retrievalOrigin, target, [{ ...seed, documentId: 'other' }]), null);
  assert.match(enrichReferenceCitation(citation, []).referenceSeedLabel, /unavailable/);
  assert.equal(isPrecedenceItem(seed), false);
  assert.equal(isPrecedenceItem(target), true);
  assert.equal(observedChunks([{ event: { chunks: [target] } }, { event: { documents: [target] } }]).length, 1);
});

test('later sparse event records preserve previously observed reference origins and metadata', () => {
  const chunks = observedChunks([{ event: { documents: [seed, target] } },
    { event: { documents: [{ id: target.id, documentId: target.documentId, text: 'Final passage' }] } }]);
  assert.equal(chunks[1].retrievalOrigin.reference, 'Resolution 2025-14');
  assert.equal(chunks[1].metadata.chunk_index, 8);
  assert.equal(chunks[1].text, 'Final passage');
  assert.match(enrichReferenceCitation(citation, chunks).referenceSeedLabel, /Page 3/);
});

test('definition labels distinguish verified headings and passage starts from passing mentions', () => {
  const heading = { ...target, headingPath: ['Appendix B', 'Resolution 2025-14'] };
  assert.match(referenceDefinitionLabel(heading), /Followed Definition: Resolution 2025-14 \(Found in Resolution 2025-14 Header\)/);
  const start = { ...target, headingPath: [], text: '## Resolution 2025-14\nRestated financial record' };
  assert.match(referenceDefinitionLabel(start), /Found at passage start/);
  assert.doesNotMatch(referenceDefinitionLabel({ ...start, text: 'See Resolution 2025-14 for more detail.' }), /Followed Definition/);
  const html = renderToStaticMarkup(createElement(CitationTooltipContent, { citation: enrichReferenceCitation({ ...citation, headingPath: heading.headingPath }, [seed, heading]), onOpen: () => {} }));
  assert.match(html, /Followed Definition/);
});

test('document boundary metadata renders its returned title and leaves ordinary chunks unmarked', () => {
  const html = renderToStaticMarkup(createElement(ChunkInspection, { chunk: { text: 'Restated figures', metadata: { isDocumentBoundary: true, boundaryTitle: 'CFO restatement letter' } } }));
  assert.match(html, /Document boundary: CFO restatement letter/);
  assert.match(html, /Restatement \/ Precedence Item/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(ChunkInspection, { chunk: seed })), /Document boundary/);
});

test('reference-origin citation click preserves offsets and highlights its PDF passage', () => {
  const value = enrichReferenceCitation({ ...citation, startOffset: 1205, endOffset: 1850 }, [seed, target]);
  let preview;
  CitationBadge({ citation: value, onCitation: (clicked) => { preview = previewSource(clicked, [seed, target]); } }).props.onClick();
  assert.equal(preview.selection.pageNumber, 9);
  assert.equal(preview.selection.startOffset, 1205);
  assert.equal(preview.selection.endOffset, 1850);
  const text = 'Unrelated introduction. Restated cost: 5,000 Other unrelated figures.';
  const ranges = findPdfPassageRanges(text, preview.selection);
  assert.equal(ranges.map((range) => text.slice(range.start, range.end)).join(''), 'Restated cost: 5,000');
});
