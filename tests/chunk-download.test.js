import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildChunkDownload, selectDownloadParents } from '../src/utils/chunkDownload.js';

const parents = [
  { id: 'p2', documentId: 'doc', prevParentId: 'p1', nextParentId: null, metadata: { page_number: 2, chunk_index: 1 }, text: 'second parent' },
  { id: 'solo', documentId: 'doc', prevParentId: null, nextParentId: null, metadata: { page_number: 3, chunk_index: 2 } },
  { id: 'p1', documentId: 'doc', prevParentId: null, nextParentId: 'p2', metadata: { page_number: 1, chunk_index: 0 }, extra: 'parent API field' },
];
const childResponses = {
  p1: { documentId: 'doc', parentId: 'p1', parent: parents[2], totalChildren: 2, extra: 'response field', children: [
    { id: 'c2', documentId: 'doc', parentId: 'p1', metadata: { page_number: 2, child_index: 1 }, embedding: [0.2] },
    { id: 'c1', documentId: 'doc', parentId: 'p1', metadata: { page_number: 1, child_index: 0 }, embedding: [0.1] },
  ] },
  p2: { documentId: 'doc', parentId: 'p2', parent: parents[0], totalChildren: 1, children: [
    { id: 'c3', documentId: 'doc', parentId: 'p2', metadata: { page_number: 2, child_index: 0 } },
  ] },
  solo: { documentId: 'doc', parentId: 'solo', parent: parents[1], totalChildren: 0, children: [] },
};
const args = { parents, childResponses, documentId: 'doc', filename: 'guide.pdf', format: 'md' };

test('all chunks export keeps global parent order, child order, exact records and response fields', () => {
  const content = buildChunkDownload({ ...args, scope: 'all' });
  assert.ok(content.indexOf('Parent 1 — p1') < content.indexOf('Parent 2 — p2'));
  assert.ok(content.indexOf('Child 1 — c1') < content.indexOf('Child 2 — c2'));
  assert.match(content, /"embedding": \[\s+0\.2/);
  assert.match(content, /"extra": "parent API field"/);
  assert.match(content, /"extra": "response field"/);
  assert.match(content, /"nextParentId": "p2"/);
});

test('specific page includes its children and their parent without exporting other page children', () => {
  const content = buildChunkDownload({ ...args, scope: 'page', page: 1, format: 'txt' });
  assert.match(content, /Parent 1 — p1/);
  assert.match(content, /Child 1 — c1/);
  assert.doesNotMatch(content, /"id": "c2"/);
  assert.doesNotMatch(content, /Parent 2 — p2/);
});

test('across-page export includes linked parents and cross-page children, excluding isolated page', () => {
  assert.deepEqual(selectDownloadParents(parents, childResponses, 'across').map((item) => item.id), ['p1', 'p2']);
  const content = buildChunkDownload({ ...args, scope: 'across' });
  assert.match(content, /Page 1: Parent p1.*Page 2: Child c2.*Page 2: Parent p2/s);
  assert.doesNotMatch(content, /Parent solo/);
  const oneWay = parents.map((parent) => parent.id === 'p1' ? { ...parent, nextParentId: null } : parent);
  const oneWayResponses = { ...childResponses, p1: { ...childResponses.p1, children: [childResponses.p1.children[1]] } };
  assert.deepEqual(selectDownloadParents(oneWay, oneWayResponses, 'across').map((item) => item.id), ['p1', 'p2']);
});
