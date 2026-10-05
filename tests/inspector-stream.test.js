import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let streamChat;
let watchProgress;

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  ({ streamChat } = await vite.ssrLoadModule('/src/services/chatStream.js'));
  ({ watchProgress } = await vite.ssrLoadModule('/src/services/progressStream.js'));
  const session = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  session.registerSession({ getToken: () => 'test-token' });
});

test('completed progress replay closes the client reader even if the server keeps SSE open', async () => {
  const oldFetch = globalThis.fetch;
  let cancelled = false;
  globalThis.fetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"completed","eventId":"terminal-1"}\n\n'));
    },
    cancel() { cancelled = true; },
  }), { headers: { 'content-type': 'text/event-stream' } });
  try {
    const seen = [];
    const result = await watchProgress('document-1', { onEvent: (event) => seen.push(event.type) });
    assert.deepEqual(result, { done: true });
    assert.deepEqual(seen, ['completed']);
    assert.equal(cancelled, true);
  } finally {
    globalThis.fetch = oldFetch;
  }
});

after(async () => vite?.close());

test('chat trace preserves real event types and structured retrieval payloads', async () => {
  const oldFetch = globalThis.fetch;
  const frames = [
    { type: 'status', message: 'Searching' },
    { type: 'tool_start', tool: 'search', query: 'late pickup' },
    { type: 'tool_finish', tool: 'search', message: '2 matches' },
    { type: 'retrieval', retrievedParents: [{ id: 'parent-1' }], addedNeighbors: [{ id: 'parent-2' }], gradingDecisions: [{ id: 'parent-1', relevant: true }] },
    { type: 'retrieval_candidates', attempt: 1, query: 'pickup', documents: [{ id: 'parent-1', retrievalScore: 0.8 }] },
    { type: 'rerank_result', attempt: 1, documents: [{ id: 'parent-1', rerankScore: 0.9 }] },
    { type: 'neighbor_expansion', attempt: 1, seedParentIds: ['parent-1'], addedParentIds: ['parent-2'], documents: [{ id: 'parent-2', retrievalOrigin: { type: 'neighbor', seedParentId: 'parent-1', direction: 'next' } }] },
    { type: 'grading_result', attempt: 1, decisionSource: 'model', decisions: [{ parentId: 'parent-1', relevant: true }] },
    { type: 'generation_context', intent: 'answer', documents: [{ id: 'parent-1' }], contextText: 'Exact context' },
    { type: 'token', text: 'Answer' },
    { type: 'done' },
  ];
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join('')));
        controller.close();
      },
    }), { headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    const events = [];
    const answer = await streamChat({ question: 'Question' }, (event) => events.push(event));
    assert.equal(answer, 'Answer');
    assert.deepEqual(events.map((event) => event.type), frames.map((frame) => frame.type));
    assert.deepEqual(events[3].addedNeighbors, [{ id: 'parent-2' }]);
  } finally {
    globalThis.fetch = oldFetch;
  }
});
