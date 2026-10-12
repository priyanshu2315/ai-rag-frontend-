import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import { createServer } from 'vite';
import { citations, retrieved, usage, v2Chunks, v2Citations, v2StepCost, v2Usage } from './chat-source-fixtures.js';
import { evidenceForAnswer } from '../src/utils/chatSources.js';
import { summarizeTrace } from '../src/utils/crag.js';

let vite, streamChat, chatService, client, reducer, actions, slice, loadCitationParent;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ streamChat } = await vite.ssrLoadModule('/src/services/chatStream.js'));
  ({ default: chatService } = await vite.ssrLoadModule('/src/services/chatService.js'));
  ({ loadCitationParent } = await vite.ssrLoadModule('/src/services/citationSource.js'));
  const session = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  session.registerSession({ getToken: () => 'crag-test-jwt' });
  client = session.default;
  slice = await vite.ssrLoadModule('/src/redux/slices/chatSlice.js');
  reducer = slice.default;
  actions = await vite.ssrLoadModule('/src/redux/actions/chatActions.js');
  const { default: notify } = await vite.ssrLoadModule('/src/utils/notify.js');
  notify.error = () => {};
});
after(async () => vite?.close());

const streamResponse = (events) => {
  const bytes = new TextEncoder().encode(': heartbeat\r\n\r\n' + events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
    controller.close();
  } }), { headers: { 'content-type': 'text/event-stream' } });
};

test('authenticated fragmented CRLF chat dispatches every CRAG stage and streams exact Unicode tokens', async () => {
  const oldFetch = globalThis.fetch;
  const events = [
    { type: 'status', message: 'Security check' },
    { type: 'tool_start', tool: 'Intent Classifier' },
    { type: 'tool_finish', tool: 'Intent Classifier', intent: 'search' },
    { type: 'tool_finish', tool: 'Question Splitter', queries: ['D08 operating cost', 'D08 fiscal year'] },
    { type: 'retrieval_candidates', attempt: 1, query: 'D08 cost', documents: [{ id: 'p1' }] },
    { type: 'rerank_result', attempt: 1, documents: [{ id: 'p1', rerankScore: 0.9 }] },
    { type: 'neighbor_expansion', attempt: 1, addedParentIds: ['p2'], documents: [{ id: 'p2', retrievalOrigin: { type: 'table_continuation' } }] },
    { type: 'grading_result', attempt: 1, keptParentIds: ['p1'], decisions: [{ parentId: 'p1', relevant: true, reason: 'Missing fiscal year' }] },
    { type: 'status', message: 'Follow-up search for missing fact: D08 fiscal 2023 cost' },
    { type: 'tool_start', tool: 'Query Rewriter' },
    { type: 'tool_finish', tool: 'Query Rewriter', query: 'D08 fiscal 2023 cost' },
    { type: 'retrieval_candidates', attempt: 2, documents: [{ id: 'p3' }] },
    { type: 'grading_result', attempt: 2, keptParentIds: ['p3'], decisions: [{ parentId: 'p3', relevant: true }] },
    { type: 'generation_context', intent: 'search', documents: [{ id: 'p3' }], contextText: '<document>2023 cost</document>' },
    { type: 'token', text: '₹500 ' },
    { type: 'token', text: '[p3: Page 4]' },
    { type: 'done' },
  ];
  globalThis.fetch = async (url, options) => {
    assert.ok(url.endsWith('/api/chat'));
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer crag-test-jwt');
    assert.equal(options.headers.Accept, 'text/event-stream');
    assert.deepEqual(JSON.parse(options.body), { question: 'Cost?', documentId: 'd1', conversationId: 'c1' });
    return streamResponse(events);
  };
  try {
    const store = configureStore({ reducer: { chat: reducer } });
    store.dispatch(actions.fetchConversation.pending('load', 'd1'));
    store.dispatch(actions.fetchConversation.fulfilled({ id: 'c1', messages: [] }, 'load', 'd1'));
    const result = await store.dispatch(actions.askQuestion({ question: 'Cost?', documentId: 'd1' }));
    assert.ok(actions.askQuestion.fulfilled.match(result));
    const answer = store.getState().chat.messages[0];
    assert.equal(answer.content, '₹500 [p3: Page 4]');
    assert.equal(answer.streaming, false);
    assert.equal(store.getState().chat.sending, false);
    assert.deepEqual(answer.steps.filter((step) => step.kind !== 'token').map((step) => step.kind), events.filter((event) => event.type !== 'token').map((event) => event.type));
    assert.equal(answer.steps.find((step) => step.kind === 'neighbor_expansion').event.documents[0].retrievalOrigin.type, 'table_continuation');
    assert.equal(answer.steps.find((step) => step.kind === 'generation_context').event.contextText, '<document>2023 cost</document>');
  } finally { globalThis.fetch = oldFetch; }
});

test('global streaming omits documentId and closes on done even if server keeps connection open', async () => {
  const oldFetch = globalThis.fetch;
  let cancelled = false;
  globalThis.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { question: 'Global?', conversationId: 'global-c' });
    return new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"type":"token","text":"Global answer"}\n\ndata: {"type":"done"}\n\n'));
    }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    assert.equal(await streamChat({ question: 'Global?', documentId: null, conversationId: 'global-c' }, () => {}), 'Global answer');
    assert.equal(cancelled, true);
  } finally { globalThis.fetch = oldFetch; }
});

test('stream error and prematurely closed answers reject without reporting success', async () => {
  const oldFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => streamResponse([{ type: 'token', text: 'Partial' }]);
    await assert.rejects(streamChat({ question: 'Q' }, () => {}), { code: 'STREAM_INTERRUPTED' });
    globalThis.fetch = async () => streamResponse([{ type: 'error', message: 'Pipeline failed' }]);
    await assert.rejects(streamChat({ question: 'Q' }, () => {}), /Pipeline failed/);
  } finally { globalThis.fetch = oldFetch; }
});

test('conversation GET hydrates history and DELETE clears state with bearer auth and correct scope', async () => {
  const previousAdapter = client.defaults.adapter;
  const requests = [];
  client.defaults.adapter = async (config) => {
    requests.push({ method: config.method, url: config.url, params: config.params });
    assert.equal(config.headers.Authorization, 'Bearer crag-test-jwt');
    return { data: { success: true, data: config.method === 'get' ? { id: 'session-1', messages: [{ id: 'm1', role: 'assistant', content: 'Saved answer' }] } : { message: 'Cleared' } },
      status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const store = configureStore({ reducer: { chat: reducer } });
    await store.dispatch(actions.fetchConversation('d1'));
    assert.equal(store.getState().chat.conversationId, 'session-1');
    assert.equal(store.getState().chat.messages[0].content, 'Saved answer');
    await store.dispatch(actions.deleteConversation('d1'));
    assert.deepEqual(store.getState().chat.messages, []);
    assert.equal(store.getState().chat.conversationId, null);
    await chatService.getConversation(null);
    await chatService.deleteConversation(null);
    assert.deepEqual(requests, [
      { method: 'get', url: '/chat/conversation', params: { documentId: 'd1' } },
      { method: 'delete', url: '/chat/conversation', params: { documentId: 'd1' } },
      { method: 'get', url: '/chat/conversation', params: undefined },
      { method: 'delete', url: '/chat/conversation', params: undefined },
    ]);
  } finally { client.defaults.adapter = previousAdapter; }
});

test('context switches ignore stale history and old answer completion', () => {
  let state = reducer(undefined, actions.fetchConversation.pending('old', 'd1'));
  state = reducer(state, actions.askQuestion.pending('old-answer', { question: 'Q' }));
  state = reducer(state, actions.fetchConversation.pending('new', 'd2'));
  state = reducer(state, actions.fetchConversation.fulfilled({ id: 'wrong', messages: [{ content: 'Wrong document' }] }, 'old', 'd1'));
  assert.equal(state.loading, true);
  assert.equal(state.conversationId, null);
  state = reducer(state, actions.askQuestion.pending('new-answer', { question: 'New Q' }));
  state = reducer(state, slice.answerStarted());
  state = reducer(state, actions.askQuestion.rejected(null, 'old-answer', {}, { message: 'Old failure' }));
  assert.equal(state.sending, true);
  assert.equal(state.messages[0].streaming, true);
});

test('a citation without live history loads its saved parent on demand and rejects mismatched records', async () => {
  const previousAdapter = client.defaults.adapter;
  let parent = { id: 'p1', documentId: 'd1', searchText: 'Saved passage', metadata: { document_title: 'Depot Handbook' } };
  client.defaults.adapter = async (config) => {
    assert.equal(config.method, 'get');
    assert.equal(config.url, '/documents/get-all-child-chunk/p1');
    assert.equal(config.headers.Authorization, 'Bearer crag-test-jwt');
    return { data: { success: true, data: { parent, children: [] } }, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const citation = { sourceId: 'p1', documentTitle: 'Depot Handbook' };
    assert.equal((await loadCitationParent(citation, { documentId: 'd1' })).searchText, 'Saved passage');
    parent = { ...parent, documentId: 'd2' };
    await assert.rejects(loadCitationParent(citation, { documentId: 'd1' }), /does not match/);
    parent = { ...parent, id: 'wrong' };
    await assert.rejects(loadCitationParent(citation), /does not match/);
    assert.equal(await loadCitationParent({ sourceId: 'Source ID' }), null);
  } finally { client.defaults.adapter = previousAdapter; }
});

test('new source, citation and usage SSE events survive byte fragmentation and stay attached to their answer', async () => {
  const oldFetch = globalThis.fetch;
  const events = [retrieved, citations, { type: 'token', text: 'D01 cost [Source ID: Page 3]' }, usage, usage, { type: 'done' }];
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer crag-test-jwt');
    return streamResponse(events);
  };
  try {
    const store = configureStore({ reducer: { chat: reducer } });
    store.dispatch(actions.fetchConversation.pending('new-load', undefined));
    store.dispatch(actions.fetchConversation.fulfilled({ id: 'c1', messages: [] }, 'new-load', undefined));
    const result = await store.dispatch(actions.askQuestion({ question: 'D01 cost?' }));
    assert.ok(actions.askQuestion.fulfilled.match(result));
    const answer = store.getState().chat.messages[0];
    assert.deepEqual(answer.retrievedChunks, retrieved.chunks);
    assert.equal(answer.retrievedChunkCount, 4);
    assert.deepEqual(answer.citations, citations.citations);
    assert.deepEqual(answer.usageSummary, usage);
    assert.equal(answer.usageSummary.totalTokens, 4120);
    assert.equal(answer.content, 'D01 cost [Source ID: Page 3]');
    assert.ok(answer.steps.some((step) => step.kind === 'citations'));
  } finally { globalThis.fetch = oldFetch; }
});

// Addendum v2 supplies the full per-invocation cost schema.
const opaqueStepCost = v2StepCost;
for (const event of [retrieved, citations, opaqueStepCost, usage]) {
  test(`${event.type}: authenticated fragmented SSE reaches the correct per-answer state`, async () => {
    const oldFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer crag-test-jwt');
      return streamResponse([event, { type: 'token', text: 'Answer' }, { type: 'done' }]);
    };
    try {
      const store = configureStore({ reducer: { chat: reducer } });
      store.dispatch(slice.answerStarted());
      const seen = [];
      const answer = await streamChat({ question: 'Q', conversationId: 'c1' }, (frame) => {
        seen.push(frame.type);
        actions.applyEvent(store.dispatch, frame);
        if (frame.type === event.type) {
          const message = store.getState().chat.messages[0];
          assert.equal(message.content, '', 'metadata arrives before answer text');
          assert.deepEqual(message.steps[0].event, event);
          if (event.type === 'retrieved_chunks') {
            assert.deepEqual(message.retrievedChunks, event.chunks);
            assert.equal(message.retrievedChunkCount, event.count);
          }
          if (event.type === 'citations') assert.deepEqual(message.citations, event.citations);
          if (event.type === 'step_cost') {
            assert.deepEqual(message.stepCosts, [event]);
            assert.equal(message.usageSummary, undefined, 'a step cost never fabricates a final total');
          }
          if (event.type === 'total_usage_summary') assert.deepEqual(message.usageSummary, event);
        }
      });
      assert.equal(answer, 'Answer');
      assert.deepEqual(seen, [event.type, 'token', 'done']);
    } finally { globalThis.fetch = oldFetch; }
  });
}

test('step costs appear during processing and stay separate from the final authoritative summary', async () => {
  const oldFetch = globalThis.fetch;
  const cost = { ...opaqueStepCost, eventId: 'cost-1' };
  globalThis.fetch = async () => streamResponse([retrieved, cost, cost, citations,
    { type: 'token', text: 'Answer [Source ID: Page 3]' }, usage, usage, { type: 'done' }]);
  try {
    const store = configureStore({ reducer: { chat: reducer } });
    store.dispatch(actions.fetchConversation.pending('step-load', undefined));
    store.dispatch(actions.fetchConversation.fulfilled({ id: 'c1', messages: [] }, 'step-load', undefined));
    const result = await store.dispatch(actions.askQuestion({ question: 'Cost?' }));
    assert.ok(actions.askQuestion.fulfilled.match(result));
    const message = store.getState().chat.messages[0];
    assert.deepEqual(message.stepCosts, [cost]);
    assert.deepEqual(message.usageSummary, usage);
    assert.equal(message.steps.filter((step) => step.kind === 'step_cost').length, 1);
    assert.equal(message.usageSummary.totalCostINR, 0.0384);
  } finally { globalThis.fetch = oldFetch; }
});

test('parallel Hybrid Search completions match their query without closing another running search', () => {
  const store = configureStore({ reducer: { chat: reducer } });
  store.dispatch(slice.answerStarted());
  for (const query of ['D01 fiscal 2022', 'D08 fiscal 2023']) actions.applyEvent(store.dispatch, { type: 'tool_start', tool: 'Hybrid Search', query });
  let starts = store.getState().chat.messages[0].steps.filter((step) => step.kind === 'tool_start');
  assert.equal(starts.length, 2);
  assert.ok(starts.every((step) => !step.done));
  actions.applyEvent(store.dispatch, { type: 'retrieval_candidates', attempt: 1, query: 'D08 fiscal 2023', documents: [v2Chunks[1]] });
  actions.applyEvent(store.dispatch, { type: 'tool_finish', tool: 'Hybrid Search', query: 'D08 fiscal 2023', message: 'Found D08' });
  starts = store.getState().chat.messages[0].steps.filter((step) => step.kind === 'tool_start');
  assert.equal(starts[0].done, false);
  assert.equal(starts[1].done, true);
  actions.applyEvent(store.dispatch, { type: 'retrieval_candidates', attempt: 1, query: 'D01 fiscal 2022', documents: [v2Chunks[0]] });
  actions.applyEvent(store.dispatch, { type: 'tool_finish', tool: 'Hybrid Search', query: 'D01 fiscal 2022', message: 'Found D01' });
  const trace = summarizeTrace(store.getState().chat.messages[0].steps);
  assert.equal(trace.queryGroups.length, 2);
  assert.deepEqual(trace.rounds[0].queries, ['D08 fiscal 2023', 'D01 fiscal 2022']);
  assert.ok(store.getState().chat.messages[0].steps.filter((step) => step.kind === 'tool_start').every((step) => step.done));
});

test('multi-round evidence and citations retain round-one facts during fast next-hop routing', async () => {
  const oldFetch = globalThis.fetch;
  const finalDocs = v2Chunks.map((chunk, index) => ({ id: chunk.id, documentId: chunk.documentId, text: chunk.text, searchText: chunk.searchText,
    retrievalOrigin: chunk.retrievalOrigin, metadata: { chunk_index: index, page_number: chunk.pageNumber, source_pages: chunk.sourcePages, heading_path: chunk.headingPath } }));
  const events = [
    { type: 'retrieved_chunks', count: 1, chunks: [v2Chunks[0]] },
    { type: 'grading_result', attempt: 1, keptParentIds: [v2Chunks[0].id], decisions: [{ parentId: v2Chunks[0].id, relevant: true }] },
    { type: 'tool_finish', tool: 'Query Rewriter', message: 'Follow-up search for: D08 fiscal 2023', query: 'D08 fiscal 2023' },
    { type: 'retrieved_chunks', count: 1, chunks: [v2Chunks[1]] },
    { type: 'grading_result', attempt: 2, keptParentIds: v2Chunks.map((chunk) => chunk.id), decisions: [] },
    { type: 'tool_finish', tool: 'Relevance Grader', message: '2 verified chunk(s) across all searches.' },
    { type: 'generation_context', documents: finalDocs },
    { type: 'citations', eventId: 'v2-citations', citations: v2Citations }, v2StepCost,
    { type: 'token', text: 'Costs [Source ID: Page 3-4] [Page 4]' }, v2Usage, { type: 'done' },
  ];
  globalThis.fetch = async () => streamResponse(events);
  try {
    const store = configureStore({ reducer: { chat: reducer } });
    const result = await store.dispatch(actions.askQuestion({ question: 'Compare costs' }));
    assert.ok(actions.askQuestion.fulfilled.match(result));
    const message = store.getState().chat.messages[0];
    assert.deepEqual(message.retrievedChunks.map((chunk) => chunk.id), v2Chunks.map((chunk) => chunk.id));
    assert.deepEqual(evidenceForAnswer(message).map((chunk) => chunk.id), v2Chunks.map((chunk) => chunk.id));
    assert.equal(evidenceForAnswer(message)[0].fileUrl, v2Chunks[0].fileUrl);
    assert.equal(message.citationIndex.bySourceId['Page 3-4'][0].chunkId, v2Chunks[0].id);
    assert.equal(message.citationIndex.byChunkId['round2-parent'][0].sourceId, 'Page 4');
    assert.equal(message.stepCosts[0].promptTokens, 142);
    assert.equal(message.usageSummary.totalTokens, 2840);
    assert.equal(message.steps.filter((step) => step.kind === 'tool_start' && step.label === 'Query Rewriter').length, 0);
    assert.deepEqual(summarizeTrace(message.steps).followUps, ['D08 fiscal 2023']);
  } finally { globalThis.fetch = oldFetch; }
});
