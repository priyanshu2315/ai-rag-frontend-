import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupSections, matchesChunkSearch, pagesOf, sortByMetadataIndex } from '../src/utils/chunkInspector.js';

const parent = (id, sectionId, page, index, headingPath = ['Handbook', 'Late pickup']) => ({
  id,
  text: `Passage ${id}`,
  metadata: {
    section_id: sectionId,
    page_number: page,
    source_pages: [page],
    chunk_index: index,
    heading_path: headingPath,
  },
});

test('a section spanning pages stays one group, ordered by global chunk index', () => {
  const parents = [
    parent('later', 'section-1', 2, 8),
    parent('new-section', 'section-2', 2, 9, ['Handbook', 'Attendance']),
    parent('earlier', 'section-1', 1, 7),
  ];
  const groups = groupSections(parents, 'document-a');
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].parents.map((item) => item.id), ['earlier', 'later']);
  assert.deepEqual(groups[0].pages, [1, 2]);
  assert.deepEqual(groups[0].headingPath, ['Handbook', 'Late pickup']);
  assert.equal(groups[1].sectionId, 'section-2');
  assert.notEqual(groups[0].key, groupSections(parents, 'document-b')[0].key);
});

test('missing section IDs do not imply a shared section', () => {
  const groups = groupSections([parent('a', null, 1, 1), parent('b', null, 2, 2)], 'document-a');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].sectionId, null);
  assert.equal(groups[1].sectionId, null);
});

test('page extraction does not mutate API metadata and search includes loaded children', () => {
  const metadata = { source_pages: [1], page_number: 2 };
  assert.deepEqual(pagesOf(metadata), [1, 2]);
  assert.deepEqual(metadata.source_pages, [1]);
  const item = parent('parent-a', 'section-1', 1, 1);
  assert.equal(matchesChunkSearch(item, { items: [{ id: 'child-a', text: 'pickup details' }] }, 'pickup details'), true);
  assert.equal(matchesChunkSearch(item, undefined, 'pickup details'), false);
  assert.deepEqual(sortByMetadataIndex([
    { id: 'later', metadata: { child_index: 2 } },
    { id: 'earlier', metadata: { child_index: 1 } },
  ], 'child_index').map((child) => child.id), ['earlier', 'later']);
});
