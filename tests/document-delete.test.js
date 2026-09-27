import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import { createServer } from 'vite';

let vite;
let client;
let originalAdapter;
let actions;
let chunkActions;
let documentsReducer;
let chunksReducer;
let canDeleteDocument;
let unauthorized = 0;

const documentId = '12345678-1234-4234-8234-123456789abc';
const otherId = '12345678-1234-4234-8234-123456789abd';
const documents = [
  { id: documentId, filename: 'report.pdf', status: 'COMPLETED' },
  { id: otherId, filename: 'other.pdf', status: 'FAILED' },
];

before(async () => {
  // Use Vite's resolver for the app's extensionless imports and runtime env.
  // HTTP is replaced at the Axios adapter; no real document is deleted.
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  const api = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  client = api.default;
  originalAdapter = client.defaults.adapter;
  api.registerSession({
    getToken: () => 'test-access-token',
    isAuthenticated: () => true,
    onUnauthorized: () => { unauthorized += 1; },
  });
  const { default: notify } = await vite.ssrLoadModule('/src/utils/notify.js');
  notify.error = () => {};
  actions = await vite.ssrLoadModule('/src/redux/actions/documentActions.js');
  chunkActions = await vite.ssrLoadModule('/src/redux/actions/chunkActions.js');
  documentsReducer = (await vite.ssrLoadModule('/src/redux/slices/documentSlice.js')).default;
  chunksReducer = (await vite.ssrLoadModule('/src/redux/slices/chunkSlice.js')).default;
  ({ canDeleteDocument } = await vite.ssrLoadModule('/src/constants/documentStatus.js'));
});

after(async () => {
  if (client) client.defaults.adapter = originalAdapter;
  await vite?.close();
});

const makeStore = (selectedId = documentId) => {
  const store = configureStore({ reducer: { documents: documentsReducer, chunks: chunksReducer } });
  store.dispatch(actions.fetchDocuments.fulfilled(documents, 'list', undefined));
  store.dispatch(chunkActions.fetchParentChunks.pending('parents', selectedId));
  store.dispatch(chunkActions.fetchParentChunks.fulfilled([{ id: 'parent-1' }], 'parents', selectedId));
  store.dispatch(chunkActions.fetchChildChunks.pending('children', 'parent-1'));
  store.dispatch(chunkActions.fetchChildChunks.fulfilled({ children: [{ id: 'child-1' }] }, 'children', 'parent-1'));
  return store;
};

const success = (config) => ({
  config, status: 200, statusText: 'OK', headers: {},
  data: { success: true, message: 'Document deleted successfully', data: { documentId } },
});

const rejectResponse = (status, message, config) => {
  const error = new Error(message);
  error.config = config;
  error.response = { status, data: { success: false, error: message } };
  return Promise.reject(error);
};

test('sends an authenticated DELETE without body or query, and removes data only after success', async () => {
  const store = makeStore();
  let finish;
  client.defaults.adapter = (config) => new Promise((resolve) => {
    assert.equal(config.method, 'delete');
    assert.equal(config.url, `/documents/${documentId}`);
    assert.equal(config.headers.get('Authorization'), 'Bearer test-access-token');
    assert.equal(config.data, undefined);
    assert.equal(config.params, undefined);
    finish = () => resolve(success(config));
  });

  const request = store.dispatch(actions.deleteDocument(documentId));
  assert.equal(store.getState().documents.deletingId, documentId);
  assert.equal(store.getState().documents.list.length, 2);
  await new Promise((resolve) => setImmediate(resolve));
  finish();
  const result = await request;

  assert.ok(actions.deleteDocument.fulfilled.match(result));
  assert.equal(result.payload.documentId, documentId);
  assert.equal(store.getState().documents.deletingId, null);
  assert.deepEqual(store.getState().documents.list.map((doc) => doc.id), [otherId]);
  assert.deepEqual(store.getState().chunks.parents, []);
  assert.deepEqual(store.getState().chunks.children, {});

  // These responses may already be in flight when deletion finishes.
  store.dispatch(actions.fetchDocuments.fulfilled(documents, 'stale-list', undefined));
  store.dispatch(chunkActions.fetchParentChunks.fulfilled([{ id: 'parent-1' }], 'parents', documentId));
  store.dispatch(chunkActions.fetchChildChunks.fulfilled({ children: [{ id: 'child-1' }] }, 'children', 'parent-1'));
  assert.deepEqual(store.getState().documents.list.map((doc) => doc.id), [otherId]);
  assert.deepEqual(store.getState().chunks.parents, []);
  assert.deepEqual(store.getState().chunks.children, {});
});

test('deleting another document preserves the selected document chunk cache', async () => {
  const store = makeStore(otherId);
  const previousChunks = store.getState().chunks;
  client.defaults.adapter = async (config) => success(config);
  await store.dispatch(actions.deleteDocument(documentId));
  assert.deepEqual(store.getState().chunks, previousChunks);
});

for (const [status, message] of [
  [400, 'Invalid document UUID'],
  [401, 'Unauthorized: Invalid token'],
  [404, 'Document not found'],
  [409, 'Document is still processing'],
  [502, 'Supabase could not remove the uploaded file'],
  [500, 'Unexpected database failure'],
]) {
  test(`${status} preserves the document and chunks and exposes the server error`, async () => {
    const store = makeStore();
    const previousChunks = store.getState().chunks;
    const previousUnauthorized = unauthorized;
    client.defaults.adapter = (config) => rejectResponse(status, message, config);
    const result = await store.dispatch(actions.deleteDocument(documentId));

    assert.ok(actions.deleteDocument.rejected.match(result));
    assert.equal(result.payload.status, status);
    assert.equal(store.getState().documents.deletingId, null);
    assert.equal(store.getState().documents.deleteError, message);
    assert.equal(store.getState().documents.error, null);
    assert.equal(store.getState().documents.list.length, 2);
    assert.deepEqual(store.getState().chunks, previousChunks);
    assert.equal(unauthorized, previousUnauthorized + (status === 401 ? 1 : 0));
  });
}

test('retrying a partial failure sends the same DELETE and clears the previous error', async () => {
  const store = makeStore();
  const urls = [];
  client.defaults.adapter = (config) => {
    urls.push(config.url);
    return rejectResponse(500, 'Database deletion failed', config);
  };
  await store.dispatch(actions.deleteDocument(documentId));
  client.defaults.adapter = async (config) => {
    urls.push(config.url);
    return success(config);
  };
  await store.dispatch(actions.deleteDocument(documentId));
  assert.deepEqual(urls, [`/documents/${documentId}`, `/documents/${documentId}`]);
  assert.equal(store.getState().documents.deleteError, null);
  assert.deepEqual(store.getState().documents.list.map((doc) => doc.id), [otherId]);
});

test('only COMPLETED and FAILED documents are eligible for deletion', () => {
  for (const status of ['COMPLETED', 'FAILED']) assert.equal(canDeleteDocument({ status }), true);
  for (const status of ['PROCESSING', 'QUEUED', undefined]) assert.equal(canDeleteDocument({ status }), false);
  assert.equal(canDeleteDocument(null), false);
});
