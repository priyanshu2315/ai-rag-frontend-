import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let reducer;
let fetchParentChunks;
let fetchChildChunks;

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  ({ default: reducer } = await vite.ssrLoadModule('/src/redux/slices/chunkSlice.js'));
  ({ fetchParentChunks, fetchChildChunks } = await vite.ssrLoadModule('/src/redux/actions/chunkActions.js'));
});

after(async () => vite?.close());

test('a mismatched parent response is hidden rather than shown in exact JSON', () => {
  let state = reducer(undefined, fetchParentChunks.pending('parents', 'document-a'));
  state = reducer(state, fetchParentChunks.fulfilled([
    { id: 'parent-other', documentId: 'document-b', text: 'Private passage' },
  ], 'parents', 'document-a'));
  assert.deepEqual(state.parents, []);
  assert.equal(state.parentResponse, null);
  assert.match(state.error, /do not belong/);
});

test('a mismatched child response is hidden rather than exposed in the endpoint viewer', () => {
  let state = reducer(undefined, fetchParentChunks.pending('parents', 'document-a'));
  state = reducer(state, fetchParentChunks.fulfilled([
    { id: 'parent-a', documentId: 'document-a', text: 'Owned passage' },
  ], 'parents', 'document-a'));
  state = reducer(state, fetchChildChunks.pending('child-request', 'parent-a'));
  state = reducer(state, fetchChildChunks.fulfilled({
    documentId: 'document-a', parentId: 'parent-a',
    parent: { id: 'parent-a', documentId: 'document-a' },
    children: [{ id: 'child-other', parentId: 'parent-a', documentId: 'document-b', text: 'Private passage' }],
  }, 'child-request', 'parent-a'));
  assert.deepEqual(state.children['parent-a'].items, []);
  assert.equal(state.children['parent-a'].response, undefined);
  assert.match(state.children['parent-a'].error, /does not belong/);
});
