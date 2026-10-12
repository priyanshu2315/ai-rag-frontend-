import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderToStaticMarkup } from 'react-dom/server';
import { configureStore } from '@reduxjs/toolkit';
import { createServer } from 'vite';
import { messageCitations, messageUsage, normalizeCitations, messageSteps, messageStepCosts } from '../src/utils/messageMetadata.js';
import { previewSource, pdfPageUrl, resolveCitations } from '../src/utils/chatSources.js';
import { v2Citations, v2Usage } from './chat-source-fixtures.js';

let vite, reducer, actions, client, MessageBubble, CitationBadge, SourceContent, loadCitationParent;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: reducer } = await vite.ssrLoadModule('/src/redux/slices/chatSlice.js'));
  actions = await vite.ssrLoadModule('/src/redux/actions/chatActions.js');
  const session = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  client = session.default;
  session.registerSession({ getToken: () => 'history-jwt' });
  ({ default: MessageBubble } = await vite.ssrLoadModule('/src/components/chat/MessageBubble.jsx'));
  ({ CitationBadge } = await vite.ssrLoadModule('/src/components/chat/Markdown.jsx'));
  ({ SourceContent } = await vite.ssrLoadModule('/src/components/chat/SourceDrawer.jsx'));
  ({ loadCitationParent } = await vite.ssrLoadModule('/src/services/citationSource.js'));
});
after(async () => vite?.close());

const content = 'D08 operating cost was 4,120 [Source ID: Page 3-4].';
const history = () => ({ id: 'saved-conversation', userId: 'user1', documentId: 'depot-doc', messages: [
  { id: 'user1', role: 'user', content: 'D08 cost?', metadata: null, createdAt: '2026-10-11T05:30:00.000Z' },
  { id: 'assistant1', role: 'assistant', content, metadata: { citations: v2Citations, totalTokens: 2840, totalCostINR: 0.245, formattedTotalCost: '₹0.25', extra: { preserved: true } }, createdAt: '2026-10-11T05:30:15.000Z' },
] });
const store = () => configureStore({ reducer: { chat: reducer } });
const withHistory = async (run, payload = history()) => {
  const prior = client.defaults.adapter;
  client.defaults.adapter = async (config) => {
    assert.equal(config.method, 'get');
    assert.equal(config.url, '/chat/conversation');
    assert.equal(config.headers.Authorization, 'Bearer history-jwt');
    return { data: { success: true, data: payload }, status: 200, statusText: 'OK', headers: {}, config };
  };
  try { await run(); } finally { client.defaults.adapter = prior; }
};

test('authenticated history replays complete saved reasoning and costs as settled steps', async () => {
  const payload = history();
  const parent = { id: 'round1-parent', documentId: 'depot-doc', text: 'Saved definition passage', metadata: { chunk_index: 7, heading_path: ['Operating costs'], document_title: 'Depot Handbook' }, retrievalOrigin: { type: 'section_lead', seedParentId: 'seed' } };
  const events = [
    { type: 'status', message: 'Checking saved evidence' },
    { type: 'tool_start', tool: 'Question Splitter' },
    { type: 'tool_finish', tool: 'Question Splitter', queries: ['D08 operating cost', 'Find restatement'] },
    { type: 'tool_finish', tool: 'Intent Classifier', intent: 'page', pageNumber: 3 },
    { type: 'retrieval_candidates', query: 'D08 operating cost', attempt: 1, documents: [parent] },
    { type: 'rerank_result', query: 'D08 operating cost', attempt: 1, documents: [{ ...parent, rerankScore: 0.92 }] },
    { type: 'neighbor_expansion', documents: [parent] },
    { type: 'retrieved_chunks', count: 1, chunks: [parent] },
    { type: 'grading_result', query: 'D08 operating cost', decisions: [{ parentId: parent.id, relevant: true }, { parentId: 'discarded', relevant: false }], keptParentIds: [parent.id] },
    { type: 'tool_finish', tool: 'Query Rewriter', query: 'Resolution 2025-14 cost' },
    { type: 'generation_context', documents: [parent] },
    { type: 'step_cost', step: 'Saved Relevance Grader', totalTokens: 200, formattedINR: '₹0.01' },
    { type: 'total_usage_summary', totalTokens: 200, formattedTotalCost: '₹0.01', breakdown: [{ step: 'Saved Relevance Grader', totalTokens: 200, formattedINR: '₹0.01' }] },
  ];
  payload.messages[1].metadata = { citations: v2Citations, steps: events };
  await withHistory(async () => {
    const refreshed = store();
    await refreshed.dispatch(actions.fetchConversation('depot-doc'));
    const message = refreshed.getState().chat.messages[1];
    assert.deepEqual(message.metadata.steps, events);
    assert.deepEqual(messageSteps(message).map((step) => step.kind), events.map((event) => event.type));
    assert.ok(messageSteps(message).every((step) => step.done));
    assert.equal(messageStepCosts(message).length, 1);
    const html = renderToStaticMarkup(createElement(MemoryRouter, null, createElement(MessageBubble, { message })));
    for (const value of ['Reasoning Trace', 'aria-expanded="true"', 'Checking saved evidence', 'Question Splitter', 'Find restatement', 'Page 3', '0.92', 'kept', 'dropped', 'Resolution 2025-14 cost', 'Section Header &amp; Scope', 'Saved Relevance Grader', '200 tokens • ₹0.01', 'Saved definition passage']) assert.ok(html.includes(value), value);
    assert.doesNotMatch(html, /animate-spin/);
  }, payload);
});

test('malformed saved steps and legacy messages are safe and saved costs do not require totals', () => {
  for (const steps of [null, {}, [null, 'bad', {}, { type: 'token', text: 'ignored' }]]) {
    const message = { id: 'legacy', role: 'assistant', content: 'Legacy answer', metadata: { steps } };
    assert.deepEqual(messageSteps(message), []);
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(MessageBubble, { message })));
  }
  const html = renderToStaticMarkup(createElement(MessageBubble, { message: { role: 'assistant', content: 'Answer', metadata: { steps: [{ type: 'step_cost', step: 'Saved Grader', totalTokens: 0, formattedINR: '₹0.00' }] } } }));
  assert.match(html, /Saved step costs • 1/);
  assert.match(html, /Saved Grader/);
});

test('authenticated conversation hydration preserves metadata, unknown metadata keys and null user metadata', async () => {
  await withHistory(async () => {
    const current = store();
    await current.dispatch(actions.fetchConversation('depot-doc'));
    const messages = current.getState().chat.messages;
    assert.equal(messages[0].metadata, null);
    assert.deepEqual(messages[1].metadata, history().messages[1].metadata);
    assert.equal(messages[1].citationIndex.byChunkId['round1-parent'][0].sourceId, 'Page 3-4');
    assert.equal(messages[1].streaming, undefined);
    assert.doesNotThrow(() => renderToStaticMarkup(createElement(MessageBubble, { message: messages[0] })));
  });
});

test('a fresh store restores interactive citation pills, tooltip actions and PDF destinations from metadata alone', async () => {
  await withHistory(async () => {
    const initial = store();
    await initial.dispatch(actions.fetchConversation('depot-doc'));
    const refreshed = store();
    await refreshed.dispatch(actions.fetchConversation('depot-doc'));
    const message = refreshed.getState().chat.messages[1];
    assert.equal(message.citations, undefined, 'history requires no transient SSE citations array');
    const html = renderToStaticMarkup(createElement(MessageBubble, { message }));
    for (const value of ['📄 Page 3-4 • Depot Handbook', 'role="tooltip"', v2Citations[0].displayLabel, 'View in Document', 'Open Source PDF', '2,840 tokens • ₹0.25']) assert.ok(html.includes(value), value);
    const resolved = resolveCitations(message.content, messageCitations(message))[0];
    let viewer;
    CitationBadge({ citation: resolved.citation, onCitation: (citation) => { viewer = previewSource(citation); } }).props.onClick();
    assert.equal(viewer.file.fileUrl, v2Citations[0].fileUrl);
    assert.equal(viewer.selection.pageNumber, 3);
    assert.equal(viewer.selection.startOffset, 124);
    assert.equal(viewer.selection.endOffset, 890);
    assert.equal(viewer.selection.text, v2Citations[0].snippet);
    assert.equal(pdfPageUrl(viewer.file.fileUrl, viewer.selection.pageNumber), `${v2Citations[0].fileUrl}#page=3`);
  });
});

test('conversation reload preserves reference-following origins and PDF links without transient evidence', async () => {
  const payload = history();
  const reference = { ...v2Citations[0], retrievalOrigin: { type: 'reference_following', seedParentId: 'saved-seed', reference: 'Resolution 2025-14' } };
  payload.messages[1].metadata.citations = [reference];
  await withHistory(async () => {
    const refreshed = store();
    await refreshed.dispatch(actions.fetchConversation('depot-doc'));
    const message = refreshed.getState().chat.messages[1];
    assert.deepEqual(message.metadata.citations[0].retrievalOrigin, reference.retrievalOrigin);
    const html = renderToStaticMarkup(createElement(MessageBubble, { message }));
    assert.match(html, /🔗 Page 3-4 \(Resolution 2025-14\)/);
    assert.match(html, /Retrieved via cross-reference/);
    assert.match(html, /Seed context unavailable/);
    const resolved = resolveCitations(message.content, messageCitations(message))[0];
    let selected;
    CitationBadge({ citation: resolved.citation, onCitation: (value) => { selected = previewSource(value); } }).props.onClick();
    assert.equal(selected.selection.pageNumber, 3);
    assert.match(selected.selection.referenceNotice, /Resolution 2025-14/);
    assert.ok(html.includes(`${reference.fileUrl}#page=3`));
  }, payload);
});

test('all documented citation spellings share a resolver and unmatched source tags stay neutral', () => {
  const citations = [v2Citations[0]];
  for (const raw of ['[Source ID: Page 3-4]', '[Page 3-4]', `[${citations[0].displayLabel}]`, `[Source: ${citations[0].displayLabel}]`]) {
    assert.equal(resolveCitations(raw, citations)[0].citation, citations[0]);
  }
  assert.equal(resolveCitations('[Page 11]', citations)[0].citation, null);
  assert.equal(resolveCitations('[Source ID: Page 3-4]', null)[0].citation, null);
  assert.deepEqual(resolveCitations('[ordinary note]', citations), []);
});

test('old, empty and malformed metadata render without links or crashes', () => {
  for (const metadata of [null, undefined, {}, { citations: [] }, { citations: {} }, { citations: [null, {}, 'bad', { sourceId: 'Page 3', snippet: {} }] }, 'bad']) {
    const message = { id: 'old', role: 'assistant', content, metadata };
    assert.deepEqual(messageCitations(message), []);
    const html = renderToStaticMarkup(createElement(MessageBubble, { message }));
    assert.match(html, /\[Page 3-4\]/);
    assert.doesNotMatch(html, /aria-label="Open source:/);
  }
  assert.deepEqual(normalizeCitations([{ ...v2Citations[0], sourcePages: {} }]), []);
  assert.equal(messageUsage({ metadata: { totalTokens: 0, totalCostINR: 0 } }).totalTokens, 0);
  assert.equal(messageUsage({ metadata: { totalTokens: {}, formattedTotalCost: {} } }), null);
});

test('saved citations with no file URL can fetch the actual parent and retain a snippet fallback', async () => {
  const citation = { ...v2Citations[0], fileUrl: null, snippet: 'Depot Code: D08 Tollwick Hub II...' };
  assert.equal(previewSource(citation).file.fileUrl, null);
  const prior = client.defaults.adapter;
  client.defaults.adapter = async (config) => {
    assert.equal(config.url, '/documents/get-all-child-chunk/round1-parent');
    const parent = { id: 'round1-parent', documentId: 'depot-doc', text: 'Full saved source passage', metadata: { document_title: 'Depot Handbook', heading_path: ['5. Financial record'] } };
    return { data: { parent, children: [] }, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    const parent = await loadCitationParent(citation, { documentId: 'depot-doc' });
    const html = renderToStaticMarkup(createElement(SourceContent, { citation, parent }));
    assert.match(html, /Full saved source passage/);
    assert.match(html, /5\. Financial record/);
    const fallback = renderToStaticMarkup(createElement(SourceContent, { citation }));
    assert.match(fallback, /Saved source preview/);
    assert.ok(fallback.includes(citation.snippet));
  } finally { client.defaults.adapter = prior; }
});

test('live SSE citations and cost totals remain in metadata after completion and historical reload', async () => {
  const priorFetch = globalThis.fetch;
  const priorAdapter = client.defaults.adapter;
  const events = [{ type: 'status', message: 'Retrieving evidence', eventId: 'saved-status-1' }, { type: 'citations', citations: v2Citations }, { type: 'token', text: content }, v2Usage, { type: 'done' }];
  globalThis.fetch = async () => new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  try {
    const live = store();
    const result = await live.dispatch(actions.askQuestion({ question: 'D08 cost?' }));
    assert.ok(actions.askQuestion.fulfilled.match(result));
    const message = live.getState().chat.messages[0];
    assert.equal(message.streaming, false);
    assert.deepEqual(message.metadata.citations, v2Citations);
    assert.equal(message.metadata.totalTokens, 2840);
    assert.equal(message.metadata.totalCostINR, 0.245);
    assert.equal(message.metadata.formattedTotalCost, '₹0.25');
    assert.deepEqual(message.metadata.steps.map((event) => event.type), ['status', 'citations', 'total_usage_summary']);
    assert.deepEqual(message.metadata.steps[0], events[0]);
    client.defaults.adapter = async (config) => ({ data: { id: 'persisted', messages: [{ id: 'db-assistant', role: 'assistant', content, metadata: JSON.parse(JSON.stringify(message.metadata)) }] }, status: 200, statusText: 'OK', headers: {}, config });
    const restored = store();
    await restored.dispatch(actions.fetchConversation(null));
    const historical = restored.getState().chat.messages[0];
    assert.deepEqual(messageCitations(historical), messageCitations(message));
    assert.equal(messageUsage(historical).formattedTotalCost, '₹0.25');
    assert.equal(resolveCitations(historical.content, messageCitations(historical))[0].citation.fileUrl, v2Citations[0].fileUrl);
    assert.deepEqual(messageSteps(historical).map((step) => step.kind), ['status', 'citations', 'total_usage_summary']);
  } finally { globalThis.fetch = priorFetch; client.defaults.adapter = priorAdapter; }
});
