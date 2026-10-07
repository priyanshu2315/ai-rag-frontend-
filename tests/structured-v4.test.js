import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyStructure, applyStructureEvent, headingTree, structureGroups, mergeChunk } from '../src/utils/structuredInspector.js';
import { createInitialProgress, progressReducer } from '../src/utils/progressReducer.js';
import { buildSourcePages, buildLiveSections, combineInspectorSections } from '../src/utils/pipelineInspector.js';
import { groupSections, pagesOf } from '../src/utils/chunkInspector.js';

const documentId = 'stress-fixture';
const identity = { title: 'Kettleby report', filename: 'report.pdf', status: 'inferred', titleSource: 'opening_cover', acceptedCandidateIds: ['cover'], proposal: { status: 'unresolved', parts: [] } };
const reference = { sourceSectionId: '5A', targetSectionId: '5', targetLabel: '5', relation: 'explains', status: 'unresolved', targetParentIds: ['p5'], evidence: { text: 'See section 5', sourceSpan: { sourceId: 's1', startOffset: 0, endOffset: 13 } } };
const metadata = { section_id: '17', chunker_version: 'structured-context-v4', section_part_index: null, section_part_span: null,
  document_identity: identity, context_compacted: true, reading_section_ids: ['18'], table_ids: ['financial'], row_ids: ['D08', 'D09', 'D10', 'D11', 'D12'],
  contains_unit_fragments: true, references: [reference], relationships: [{ status: 'unresolved', blockId: 'b2', candidateTableIds: ['t1', 't2'], reason: 'AMBIGUOUS_TABLE_MATCH' }],
  source_locations: [{ sourceId: 's1', startOffset: 0, endOffset: 20, scope: 'source_unit' }],
  context_locations: [{ sourceId: 's2', startOffset: 20, endOffset: 40, role: 'definition' }] };
const parent = { id: 'p1', documentId, metadata, text: 'Census, 1 January 2022: 158,744\nMetropolitan area, 31 December 2023: 361,092\nCity proper, 31 December 2023: 163,482', searchText: 'Contextual labelled values', totalChildren: 1 };

test('v4 preparation, embedding, transaction, searchable and summary states stay independent', () => {
  let state = emptyStructure();
  const child = { id: 'c1', parentId: 'p1', documentId, metadata: { ...metadata, token_budget: { tokenCount: 40, tokenLimit: 256 } } };
  for (const event of [{ type: 'parent_created', parent }, { type: 'parent', parent: 1, parentId: 'p1', metadata },
    { type: 'child_created', child }, { type: 'chunking_complete', totalParents: 1, totalChildren: 1 }]) state = applyStructureEvent(state, event);
  assert.equal(Object.keys(state.parents).length, 1);
  assert.equal(Object.keys(state.children).length, 1);
  assert.equal(state.children.c1.embeddingStage, undefined);
  assert.equal(state.saved, false);
  state = applyStructureEvent(state, { type: 'child', child: 1, childId: 'c1', parentId: 'p1', embeddingDetails: { dimensions: 384 }, metadata });
  assert.equal(state.children.c1.embeddingStage, 'embedded in memory');
  assert.equal(state.children.c1.embedding, undefined);
  state = applyStructureEvent(state, { type: 'saving_chunks' });
  assert.equal(state.saved, false);
  state = applyStructureEvent(state, { type: 'chunks_saved', totalParents: 1, totalChildren: 1 });
  assert.equal(state.saved, true);
  assert.equal(state.searchable, false);
  state = applyStructureEvent(state, { type: 'chunks_ready' });
  state = applyStructureEvent(state, { type: 'summary_failed' });
  state = applyStructureEvent(state, { type: 'child_created', child });
  assert.equal(state.searchable, true);
  assert.equal(state.summary, 'FAILED');
  assert.equal(state.children.c1.embeddingStage, 'embedded in memory');
  assert.deepEqual(state.parents.p1.metadata.document_identity, identity);
});

test('sections 17 and 18 are siblings based on decisions; missing parents and cycles stay visible', () => {
  const tree = headingTree([{ id: 'root' }, { id: '17', parentCandidateId: 'root' }, { id: '18', parentCandidateId: 'root' },
    { id: 'unresolved', parentCandidateId: 'missing', status: 'unresolved' }, { id: 'cycle', parentCandidateId: 'cycle' }]);
  assert.deepEqual(tree[0].children.map((node) => node.id), ['17', '18']);
  assert.deepEqual(tree.slice(1).map((node) => node.id), ['unresolved', 'cycle']);
});

test('continued D08–D12 rows retain ownership, placement, context sources and unresolved references', () => {
  const groups = structureGroups([parent, { ...parent, id: 'p2' }, { ...parent, id: 'foreign', documentId: 'other' }], documentId, 'table_ids');
  assert.equal(groups.length, 1);
  assert.equal(groups[0].chunks.length, 2);
  assert.equal(groups[0].chunks[0].metadata.section_id, '17');
  assert.deepEqual(groups[0].chunks[0].metadata.reading_section_ids, ['18']);
  assert.equal(groups[0].chunks[0].metadata.context_locations[0].sourceId, 's2');
  assert.equal(groups[0].chunks[0].metadata.source_locations[0].sourceId, 's1');
  assert.equal(groups[0].chunks[0].metadata.references[0].status, 'unresolved');
  assert.deepEqual(groups[0].chunks[0].metadata.row_ids, ['D08', 'D09', 'D10', 'D11', 'D12']);
  assert.match(groups[0].chunks[0].text, /Census, 1 January 2022: 158,744/);
  assert.match(groups[0].chunks[0].text, /Metropolitan area, 31 December 2023: 361,092/);
  assert.match(groups[0].chunks[0].text, /City proper, 31 December 2023: 163,482/);
});

test('a 19-item list counts unique IDs despite fragments and parent grouping', () => {
  const ids = Array.from({ length: 19 }, (_, index) => `item-${index + 1}`);
  const groups = structureGroups([{ ...parent, metadata: { list_item_ids: ids } },
    { id: 'fragment', parentId: 'p1', documentId, metadata: { list_item_ids: ['item-19'], contains_unit_fragments: true } }], documentId, 'list_item_ids');
  assert.equal(groups.length, 19);
  assert.equal(groups[18].chunks.length, 2);
});

test('refresh uses stored parents and retains null/older metadata without synthesizing extraction history', () => {
  const saved = groupSections([parent, { id: 'legacy', documentId, metadata: null }], documentId);
  const combined = combineInspectorSections(saved, [], true);
  assert.equal(combined[0].parents[0].metadata.section_part_span, null);
  assert.deepEqual(buildSourcePages([]), []);
  assert.deepEqual(combined[0].parts, []);
  assert.deepEqual(pagesOf(null), []);
  assert.equal(emptyStructure().identity, null);
});

test('rendered sources without physical pages remain separate and preserve parser details', () => {
  const pages = buildSourcePages(['r1', 'r2'].map((id, index) => ({ type: 'page_extracted', page: null,
    source: { id, kind: 'rendered_page', parserPageNumber: index + 1, sourcePageNumber: null, sequenceIndex: index }, text: id, parserItemCount: null })));
  assert.equal(pages.length, 2);
  assert.equal(pages[0].number, null);
  assert.equal(pages[1].source.parserPageNumber, 2);
});

test('late child preparation preserves richer completed diagnostics and child-before-parent merges once', () => {
  const merged = mergeChunk({ metadata: { embedding: { model: 'local', tokenCount: 10 } }, embeddingDetails: { dimensions: 384 } }, { metadata: { token_budget: { tokenCount: 10 } } });
  assert.equal(merged.metadata.embedding.model, 'local');
  assert.equal(merged.embeddingDetails.dimensions, 384);
  const sections = buildLiveSections([{ type: 'child_created', child: { id: 'c1', parentId: 'p1' } },
    { type: 'parent_created', parent }, { type: 'parent_created', documentId: 'other', parent: { id: 'foreign' } }], documentId);
  assert.equal(sections.reduce((sum, section) => sum + section.parents.length, 0), 1);
  assert.equal(sections.find((section) => section.sectionId === '17').parents[0].children.length, 1);
});

test('terminal failure retains specific diagnostics and unknown raw events; reconnect retains session data', () => {
  let state = createInitialProgress();
  for (const event of [{ type: 'chunking_failed', code: 'CHUNK_CONTEXT_TOO_LARGE', details: { unitId: 'unit-12', tokenLimit: 256 } },
    { type: 'failed', message: 'Document processing failed.' }, { type: 'future_event', extra: 42 }]) state = progressReducer(state, { type: 'event', event });
  state = progressReducer(state, { type: 'connected' });
  assert.equal(state.timeline.length, 3);
  assert.equal(state.timeline[2].extra, 42);
  assert.equal(state.structure.diagnostics[0].details.unitId, 'unit-12');
  assert.equal(state.phase, 'failed');
});
