import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLiveSections, buildSourcePages, combineInspectorSections } from '../src/utils/pipelineInspector.js';
import { createInitialProgress, progressReducer } from '../src/utils/progressReducer.js';

const docId = 'document-a';
const metadata = { section_id: 'section-1', heading_path: ['Handbook', 'Pickup'], page_number: 2, chunk_index: 1 };

test('replayed section, parent links, child embedding and empty sections merge by real IDs', () => {
  const events = [
    { type: 'section', sectionId: 'section-1', headingPath: ['Handbook', 'Pickup'], page: 1 },
    { type: 'section_part', sectionId: 'section-1', headingPath: ['Handbook', 'Pickup'], page: 2, partIndex: 1, text: 'Continued passage' },
    { type: 'parent_created', parent: { id: 'parent-1', documentId: docId, text: 'Raw parent', searchText: 'Contextual parent', prevParentId: null, nextParentId: null, metadata } },
    { type: 'child_created', child: { id: 'child-1', parentId: 'parent-1', text: 'Raw child', metadata: { ...metadata, child_index: 0 } } },
    { type: 'parent_links', sectionId: 'section-1', parentId: 'parent-1', prevParentId: 'parent-0', nextParentId: null },
    { type: 'child', childId: 'child-1', parentId: 'parent-1', searchText: 'Contextual child', embeddingDetails: { tokenCount: 42 }, metadata: { ...metadata, child_index: 0 } },
    { type: 'chunking_complete', sections: [
      { id: 'section-1', headingPath: ['Handbook', 'Pickup'], sourcePages: [1, 2], totalParents: 1, totalChildren: 1 },
      { id: 'section-empty', headingPath: ['Handbook', 'Empty'], sourcePages: [3], totalParents: 0, totalChildren: 0 },
    ] },
  ];
  const sections = buildLiveSections(events, docId);
  assert.equal(sections.length, 2);
  assert.deepEqual(sections[0].pages, [1, 2]);
  assert.equal(sections[0].parents[0].prevParentId, 'parent-0');
  assert.equal(sections[0].parents[0].children[0].searchText, 'Contextual child');
  assert.equal(sections[0].parents[0].children[0].embeddingDetails.tokenCount, 42);
  assert.equal(sections[1].parents.length, 0);
  const combined = combineInspectorSections([{ ...sections[0], parents: [{ id: 'parent-1', text: 'Saved parent' }] }], sections, true);
  assert.equal(combined[0].parents[0].text, 'Saved parent');
  assert.equal(combined[1].parents.length, 0);
});

test('source extraction decisions stay attached to the page', () => {
  const pages = buildSourcePages([
    { type: 'page_extracted', page: 1, text: 'Page body' },
    { type: 'heading_detected', page: 1, title: 'Pickup', level: 2, format: 'markdown', repeated: false },
    { type: 'code_fence', page: 1, lineNumber: 7, insideCodeBlock: true },
  ]);
  assert.equal(pages[0].text, 'Page body');
  assert.equal(pages[0].headings[0].title, 'Pickup');
  assert.equal(pages[0].fences[0].insideCodeBlock, true);
});

test('progress replay deduplicates event IDs without inflating the timeline', () => {
  const event = { type: 'parent', eventId: 'event-1', page: 1, parent: 1, parentId: 'parent-1', preview: 'Passage' };
  let state = createInitialProgress();
  state = progressReducer(state, { type: 'event', event });
  state = progressReducer(state, { type: 'event', event });
  assert.equal(state.events, 1);
  assert.equal(state.timeline.length, 1);
  assert.equal(state.pages[0].parents.length, 1);
});
