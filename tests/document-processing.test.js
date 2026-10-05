import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let documentsReducer;
let documentProgressChanged;
let fetchDocuments;
let status;
let progressReducer;
let createInitialProgress;
let watchProgress;
let streamChat;

const id = '12345678-1234-4234-8234-123456789abc';
const initial = { id, filename: 'report.pdf', status: 'PROCESSING', summaryStatus: 'PENDING' };

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  ({ default: documentsReducer, documentProgressChanged } =
    await vite.ssrLoadModule('/src/redux/slices/documentSlice.js'));
  ({ fetchDocuments } = await vite.ssrLoadModule('/src/redux/actions/documentActions.js'));
  status = await vite.ssrLoadModule('/src/constants/documentStatus.js');
  ({ progressReducer, createInitialProgress } =
    await vite.ssrLoadModule('/src/utils/progressReducer.js'));
  ({ watchProgress } = await vite.ssrLoadModule('/src/services/progressStream.js'));
  ({ streamChat } = await vite.ssrLoadModule('/src/services/chatStream.js'));
  const session = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  session.registerSession({ getToken: () => 'test-token' });
  const { default: notify } = await vite.ssrLoadModule('/src/utils/notify.js');
  notify.info = () => {};
  notify.error = () => {};
});

after(async () => vite?.close());

const start = () => documentsReducer(undefined,
  fetchDocuments.fulfilled([initial], 'list', undefined));
const event = (state, type, extra = {}) => documentsReducer(state,
  documentProgressChanged({ id, progressAction: { type: 'event', event: { type, ...extra } } }));
const doc = (state) => state.list[0];

test('indexing unlocks questions while summary remains unavailable', () => {
  let state = start();
  assert.equal(status.isNotReady(doc(state)), true);
  assert.equal(status.canRequestSummary(doc(state)), false);

  state = event(state, 'chunks_ready');
  assert.equal(doc(state).status, 'COMPLETED');
  assert.equal(doc(state).summaryStatus, 'PENDING');
  assert.equal(status.isNotReady(doc(state)), false);
  assert.equal(status.needsProgress(doc(state)), true);
  assert.equal(status.canRequestSummary(doc(state)), false);

  state = event(state, 'summarizing');
  assert.equal(doc(state).summaryStatus, 'PROCESSING');
  state = event(state, 'completed');
  assert.equal(doc(state).summaryStatus, 'COMPLETED');
  assert.equal(status.canRequestSummary(doc(state)), true);
  assert.equal(status.needsProgress(doc(state)), false);
});

test('summary failure keeps questions available without enabling full summary', () => {
  let state = event(start(), 'chunks_ready');
  state = event(state, 'summary_failed', { message: 'Summary worker failed' });
  assert.equal(doc(state).status, 'COMPLETED');
  assert.equal(doc(state).summaryStatus, 'FAILED');
  assert.equal(status.isNotReady(doc(state)), false);
  assert.equal(status.canRequestSummary(doc(state)), false);
  assert.equal(status.needsProgress(doc(state)), false);
  assert.equal(state.progressById[id].message, 'Summary worker failed');
});

test('indexing failure keeps both actions disabled', () => {
  const state = event(start(), 'failed');
  assert.equal(status.isNotReady(doc(state)), true);
  assert.equal(status.canRequestSummary(doc(state)), false);
});

test('repeated progress frames and stale list results do not duplicate or regress state', () => {
  let state = start();
  const parent = { page: 1, parent: 1, parentId: 'parent-1', preview: 'One' };
  state = event(state, 'parent', parent);
  state = event(state, 'parent', parent);
  assert.equal(state.progressById[id].pages.length, 1);
  assert.equal(state.progressById[id].pages[0].parents.length, 1);
  state = event(state, 'summarizing');
  state = documentsReducer(state, fetchDocuments.fulfilled([initial], 'stale', undefined));
  assert.equal(doc(state).status, 'COMPLETED');
  assert.equal(doc(state).summaryStatus, 'PROCESSING');
  state = event(state, 'completed');
  state = event(state, 'summarizing');
  assert.equal(doc(state).summaryStatus, 'COMPLETED');

  let progress = createInitialProgress();
  progress = progressReducer(progress, { type: 'event', event: { type: 'chunks_ready' } });
  assert.equal(progress.phase, 'chunks_ready');
});

test('authenticated progress stream treats chunks_ready as nonterminal', async () => {
  const previousFetch = globalThis.fetch;
  let requested;
  globalThis.fetch = async (url, options) => {
    requested = { url, options };
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'data: {"type":"chunks_ready"}\n\n' +
          'data: {"type":"summarizing"}\n\n' +
          'data: {"type":"summary_failed","message":"No summary"}\n\n'
        ));
        controller.close();
      },
    }), { headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    const seen = [];
    const result = await watchProgress(id, { onEvent: (frame) => seen.push(frame.type) });
    assert.deepEqual(seen, ['chunks_ready', 'summarizing', 'summary_failed']);
    assert.deepEqual(result, { done: true });
    assert.equal(requested.options.headers.Authorization, 'Bearer test-token');
    assert.match(requested.url, /\/documents\/progress\//);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('a reconnect snapshot updates state without replaying earlier events', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(
        'data: {"status":"COMPLETED","summaryStatus":"PROCESSING"}\n\n' +
        'data: {"type":"completed"}\n\n'
      ));
      controller.close();
    },
  }));
  try {
    let state = start();
    const result = await watchProgress(id, {
      onEvent: (frame) => { state = event(state, frame.type, frame); },
    });
    assert.deepEqual(result, { done: true });
    assert.equal(doc(state).status, 'COMPLETED');
    assert.equal(doc(state).summaryStatus, 'COMPLETED');
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('document chat displays direct 202 and failure messages from the backend', async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer test-token');
      assert.deepEqual(JSON.parse(options.body), {
        question: 'Summarize this document', documentId: id, conversationId: 'conversation-1',
      });
      return Response.json({ message: 'The summary is still processing.' }, { status: 202 });
    };
    await assert.rejects(
      streamChat({ question: 'Summarize this document', documentId: id,
        conversationId: 'conversation-1' }, () => {}),
      (error) => error.message === 'The summary is still processing.' &&
        error.code === 'STILL_PROCESSING' && error.retryable
    );

    globalThis.fetch = async () => Response.json(
      { message: 'Summary generation failed for this document.' }, { status: 500 }
    );
    await assert.rejects(
      streamChat({ question: 'Summarize this document', documentId: id }, () => {}),
      (error) => error.message === 'Summary generation failed for this document.' &&
        error.retryable === false
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
