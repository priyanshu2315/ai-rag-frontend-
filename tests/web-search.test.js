import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { configureStore } from '@reduxjs/toolkit';
import { createServer } from 'vite';
import { resolveCitations } from '../src/utils/chatSources.js';

let vite, reducer, actions, MessageBubble, StepByStep, buildAnswerTrace, liveStage, web;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  const session = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  session.registerSession({ getToken: () => 'web-test-jwt' });
  ({ default: reducer } = await vite.ssrLoadModule('/src/redux/slices/chatSlice.js'));
  actions = await vite.ssrLoadModule('/src/redux/actions/chatActions.js');
  ({ default: MessageBubble } = await vite.ssrLoadModule('/src/components/chat/MessageBubble.jsx'));
  ({ StepByStep } = await vite.ssrLoadModule('/src/components/chat/AnswerTimeline.jsx'));
  ({ buildAnswerTrace, liveStage } = await vite.ssrLoadModule('/src/utils/answerTrace.js'));
  web = await vite.ssrLoadModule('/src/utils/webSearch.js');
  const { default: notify } = await vite.ssrLoadModule('/src/utils/notify.js');
  notify.error = () => {};
  notify.info = () => {};
});
after(async () => vite?.close());

const sse = (events) => new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(''), {
  headers: { 'content-type': 'text/event-stream' },
});

const webHops = [{ id: 'h2', task: 'find the live USD to INR exchange rate', dependsOn: ['h1'], source: 'web' }];
const paused = [
  { type: 'tool_finish', tool: 'Question Splitter', queries: ['P11 cost'], hopPlan: [{ id: 'h1', task: 'find the cost of P11', dependsOn: [] }], webHops },
  { type: 'retrieval_candidates', attempt: 1, query: 'P11 cost', documents: [{ id: 'p1' }] },
  { type: 'approval_required', threadId: 't1', question: 'What is the cost of P11 in INR?', webHops, message: 'I need your approval to search the web before I answer.' },
  { type: 'done' },
];
const allowed = [
  { type: 'approval_result', threadId: 't1', approved: true },
  { type: 'agent_start', agent: 'Web research', tasks: webHops },
  { type: 'agent_step', agent: 'Web research', step: 1, tool: 'web_search', args: { query: 'USD to INR rate today' }, ok: true },
  { type: 'agent_step', agent: 'Web research', step: 2, tool: 'read_page', args: { url: 'https://rates.example/usd-inr' }, ok: false },
  { type: 'agent_finish', agent: 'Web research', stopReason: 'done', answer: '1 USD = 84 INR', sources: ['https://rates.example/usd-inr', 'https://news.example/fx'] },
  { type: 'generation_context', documents: [{ id: 'p1' }] },
  { type: 'token', text: 'P11 costs ₹8,400 at 84 INR per USD [https://rates.example/usd-inr, 14 Nov 2026].' },
  { type: 'done' },
];

/** A store with chat `g1` loaded and one question that paused for approval. */
const pausedChat = async () => {
  const store = configureStore({ reducer: { chat: reducer } });
  store.dispatch(actions.fetchConversation.pending('load', { chatId: 'g1' }));
  store.dispatch(actions.fetchConversation.fulfilled({ id: 'conv-1', messages: [] }, 'load', { chatId: 'g1' }));
  globalThis.fetch = async () => sse(paused);
  await store.dispatch(actions.askQuestion({ question: 'What is the cost of P11 in INR?', chatId: 'g1' }));
  return store;
};

const bubble = (message, props = {}) => renderToStaticMarkup(createElement(MessageBubble, { message, onResume: () => {}, onReload: () => {}, ...props }));
const steps = (message) => renderToStaticMarkup(createElement(StepByStep, { trace: buildAnswerTrace(message.steps), steps: message.steps, streaming: false }));
const textOf = (html) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

test('a run that pauses shows the approval card instead of an answer', async () => {
  const oldFetch = globalThis.fetch;
  try {
    const store = await pausedChat();
    const message = store.getState().chat.messages.at(-1);
    assert.equal(message.approval.status, 'awaiting');
    assert.equal(message.approval.threadId, 't1');
    assert.equal(message.content, '', 'not replaced by "no relevant information"');
    assert.equal(store.getState().chat.sending, false);

    const html = textOf(bubble(message));
    assert.match(html, /I need your approval to search the web before I answer\./);
    assert.match(html, /What will be searched find the live USD to INR exchange rate/);
    assert.match(html, /Values found in your documents \(for example an amount\) may be included in the web search\./);
    assert.match(html, /Allow web search/);
    assert.match(html, /Skip/);
    assert.doesNotMatch(html, /Answered in/);

    const panel = steps(message);
    assert.match(textOf(panel), /Asked to search the web/);
    assert.match(textOf(panel), /Waiting for your answer/);
    // The plan lists the document task as before and the web task with a "Web" badge.
    assert.match(textOf(panel), /h1 find the cost of P11/);
    assert.match(textOf(panel), /h2 find the live USD to INR exchange rate Web/);
  } finally { globalThis.fetch = oldFetch; }
});

test('Allow resumes the same run and streams the answer into the same message', async () => {
  const oldFetch = globalThis.fetch;
  try {
    const store = await pausedChat();
    const { id } = store.getState().chat.messages.at(-1);
    const count = store.getState().chat.messages.length;
    let request;
    globalThis.fetch = async (url, options) => { request = { url, options }; return sse(allowed); };

    const pending = store.dispatch(actions.resumeAnswer({ chatId: 'g1', messageId: id, threadId: 't1', approved: true }));
    const waiting = store.getState().chat.messages.at(-1);
    assert.equal(waiting.approval.pending, true, 'both buttons go off at once');
    assert.equal(waiting.approval.choice, true);
    assert.match(textOf(bubble(waiting, { busy: true })), /Allow web search/);
    assert.match(bubble(waiting, { busy: true }), /disabled=""[^>]*>[^]*Skip/);
    await pending;

    assert.ok(request.url.endsWith('/api/chat/resume'));
    assert.equal(request.options.headers.Authorization, 'Bearer web-test-jwt');
    assert.deepEqual(JSON.parse(request.options.body), { conversationId: 'conv-1', threadId: 't1', approved: true });

    const answer = store.getState().chat.messages.at(-1);
    assert.equal(store.getState().chat.messages.length, count, 'one assistant message, not two');
    assert.equal(answer.id, id);
    assert.equal(answer.approval, null);
    assert.equal(answer.streaming, false);
    assert.match(answer.content, /^P11 costs/);

    const html = bubble(answer);
    assert.doesNotMatch(textOf(html), /Allow web search/);
    assert.match(textOf(html), /Web sources/);
    assert.match(html, /href="https:\/\/news\.example\/fx"/);
    assert.match(textOf(html), /Searched on/);
    // The web fact in the answer is a plain link, never a document citation chip.
    const paragraph = html.match(/<p class="mb-3[^>]*>P11 costs[^]*?<\/p>/)[0];
    assert.match(paragraph, /<a href="https:\/\/rates\.example\/usd-inr" target="_blank" rel="noopener noreferrer"/);
    assert.doesNotMatch(paragraph, /<button|data-source-citation/);

    const panel = textOf(steps(answer));
    assert.match(panel, /User allowed web search/);
    assert.match(panel, /Web research/);
    assert.match(panel, /Searched “USD to INR rate today”/);
    assert.match(panel, /Read https:\/\/rates\.example\/usd-inr · failed/);
    assert.match(panel, /1 USD = 84 INR/);
    assert.match(panel, /Pages looked at · 2/);
  } finally { globalThis.fetch = oldFetch; }
});

test('Skip sends approved: false and the answer says the web was not searched', async () => {
  const oldFetch = globalThis.fetch;
  try {
    const store = await pausedChat();
    const { id } = store.getState().chat.messages.at(-1);
    let body;
    globalThis.fetch = async (_url, options) => {
      body = JSON.parse(options.body);
      return sse([{ type: 'approval_result', threadId: 't1', approved: false }, { type: 'token', text: 'From the documents only.' }, { type: 'done' }]);
    };
    await store.dispatch(actions.resumeAnswer({ chatId: 'g1', messageId: id, threadId: 't1', approved: false }));
    assert.equal(body.approved, false);
    const answer = store.getState().chat.messages.at(-1);
    assert.match(textOf(bubble(answer)), /Web search skipped; the answer uses your documents only\./);
    assert.match(textOf(steps(answer)), /User skipped web search/);
  } finally { globalThis.fetch = oldFetch; }
});

test('an error event puts the card back with the error and the buttons on', async () => {
  const oldFetch = globalThis.fetch;
  try {
    const store = await pausedChat();
    const before = store.getState().chat.messages.at(-1);
    globalThis.fetch = async () => sse([{ type: 'approval_result', threadId: 't1', approved: true }, { type: 'error', message: 'Web search crashed' }]);
    await store.dispatch(actions.resumeAnswer({ chatId: 'g1', messageId: before.id, threadId: 't1', approved: true }));
    const message = store.getState().chat.messages.at(-1);
    assert.equal(message.approval.status, 'awaiting');
    assert.equal(message.approval.pending, false);
    assert.equal(message.approval.error, 'Web search crashed');
    assert.equal(message.steps.length, before.steps.length, 'the failed attempt leaves no steps behind');
    const html = bubble(message);
    assert.match(textOf(html), /Web search crashed/);
    assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>[^<]*<svg[^>]*>[^]*?Allow web search/);
  } finally { globalThis.fetch = oldFetch; }
});

test('409 and 404 before the stream keep the buttons off for the reload', async () => {
  const oldFetch = globalThis.fetch;
  try {
    for (const [status, error] of [[409, 'This approval was already answered'], [404, 'No question is waiting for approval']]) {
      const store = await pausedChat();
      const { id } = store.getState().chat.messages.at(-1);
      globalThis.fetch = async () => new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } });
      const result = await store.dispatch(actions.resumeAnswer({ chatId: 'g1', messageId: id, threadId: 't1', approved: true }));
      assert.equal(result.payload.status, status);
      assert.equal(result.payload.message, error);
      const message = store.getState().chat.messages.at(-1);
      assert.equal(message.approval.pending, true, `${status}: the buttons stay off`);
      assert.equal(store.getState().chat.sending, false);
    }
  } finally { globalThis.fetch = oldFetch; }
});

test('saved messages: waiting shows Allow / Skip, resuming shows "Answering…" with Reload', () => {
  const store = configureStore({ reducer: { chat: reducer } });
  store.dispatch(actions.fetchConversation.pending('load', { chatId: 'g1' }));
  store.dispatch(actions.fetchConversation.fulfilled({ id: 'conv-1', messages: [
    { id: 'u1', role: 'user', content: 'Cost in INR?' },
    { id: 'a1', role: 'assistant', content: 'I need your approval to search the web before I answer.', metadata: { status: 'awaiting_approval', threadId: 't9', webHops, steps: paused.slice(0, 3) } },
    { id: 'a2', role: 'assistant', content: 'Waiting', metadata: { status: 'resuming', threadId: 't8', webHops: [], steps: [] } },
  ] }, 'load', { chatId: 'g1' }));
  const [, waiting, resuming] = store.getState().chat.messages;

  assert.equal(waiting.approval.threadId, 't9');
  assert.equal(waiting.content, '');
  const waitingHtml = textOf(bubble(waiting));
  assert.match(waitingHtml, /I need your approval/);
  assert.match(waitingHtml, /Allow web search/);

  const resumingHtml = textOf(bubble(resuming));
  assert.match(resumingHtml, /Answering…/);
  assert.match(resumingHtml, /Reload/);
  assert.doesNotMatch(resumingHtml, /Allow web search|Skip/);
});

test('saved web facts: sources with the search date, or the failure line', () => {
  const allowedMessage = { id: 'a', role: 'assistant', content: 'Answer.', metadata: { webApproval: true,
    webFacts: { answer: '1 USD = 0.86 EUR', sources: ['https://fx.example/eur', 'javascript:alert(1)'], stopReason: 'done', searchedAt: '2026-11-14T09:30:00.000Z' } } };
  const html = bubble(allowedMessage);
  assert.match(textOf(html), /Web sources fx\.example\/eur Searched on (14 Nov 2026|Nov 14, 2026)/);
  assert.doesNotMatch(html, /javascript:/, 'only http(s) pages become links');

  const failed = { id: 'b', role: 'assistant', content: 'Answer.', metadata: { webApproval: true, webFacts: { answer: '', sources: [], stopReason: 'failed', searchedAt: '2026-11-14T09:30:00.000Z' } } };
  assert.match(textOf(bubble(failed)), /Web search failed; answer uses documents only/);
});

test('live status: "Searching the web…", then "Searching: <query>" / "Reading: <url>"', () => {
  const at = (events, options) => liveStage(buildAnswerTrace(events.map((event) => ({ kind: event.type, event }))), options);
  const base = [paused[0], allowed[0]];
  assert.equal(at(base).label, 'Searching the web…');
  assert.equal(at([...base, allowed[1]]).label, 'Searching the web…');
  assert.equal(at([...base, ...allowed.slice(1, 3)]).label, 'Searching: USD to INR rate today');
  assert.equal(at([...base, ...allowed.slice(1, 4)]).label, 'Reading: https://rates.example/usd-inr');
  assert.notEqual(at([...base, ...allowed.slice(1, 5)]).stage, 'web', 'done searching once the agent finishes');
  assert.equal(at([...base, ...allowed.slice(1, 6)]).stage, 'answer');
  assert.notEqual(at([paused[0], { type: 'approval_result', approved: false }]).stage, 'web');
});

test('the web trace reads failures, the step limit, and ignores missing pieces', () => {
  const trace = web.buildWebTrace([
    { kind: 'agent_start', event: { type: 'agent_start', tasks: webHops } },
    { kind: 'agent_finish', event: { type: 'agent_finish', failed: true, reason: 'timeout' } },
  ]);
  assert.equal(trace.agents.length, 1, 'an older run: one agent, no agentId');
  assert.equal(trace.agents[0].finish.failed, true);
  assert.equal(trace.agents[0].task, webHops[0].task);
  assert.equal(trace.hops[0].task, webHops[0].task);
  assert.equal(web.buildWebTrace([{ kind: 'status', event: { type: 'status', message: 'x' } }]), null);
  assert.equal(web.buildWebTrace(undefined), null);
  assert.equal(web.approvalFromMetadata({ status: 'awaiting_approval' }), null, 'no threadId, no buttons');
  assert.equal(web.approvalFromMetadata(null), null);
  const html = textOf(renderToStaticMarkup(createElement(StepByStep, {
    trace: buildAnswerTrace([{ kind: 'agent_finish', event: { type: 'agent_finish', agent: 'Web research', stopReason: 'step_limit', answer: 'Partial', sources: [] } }]),
    steps: [], streaming: false,
  })));
  assert.match(html, /Stopped at the step limit and answered with what it found\./);
});

test('a bracket holding a URL is never read as a document citation', () => {
  assert.deepEqual(resolveCitations('Rate [https://fx.example, 14 Nov 2026] and [Source: https://x.example]', []), []);
  assert.equal(resolveCitations('See [Source ID: abc]', []).length, 1);
});

test('the popup flag: only for the chat on screen in a visible tab', async () => {
  const slice = await vite.ssrLoadModule('/src/redux/slices/chatSlice.js');
  const event = { type: 'approval_required', threadId: 't1', webHops, message: 'Ask' };
  const fresh = () => {
    const store = configureStore({ reducer: { chat: reducer } });
    store.dispatch(actions.fetchConversation.pending('load', { chatId: 'g1' }));
    store.dispatch(actions.fetchConversation.fulfilled({ id: 'conv-1', messages: [] }, 'load', { chatId: 'g1' }));
    store.dispatch({ ...actions.askQuestion.pending('ask', { question: 'Q', chatId: 'g1' }) });
    store.dispatch({ ...slice.answerStarted(), meta: { key: 'chat:g1' } });
    return store;
  };
  const approvalOf = (store, key = 'chat:g1') => (store.getState().chat.activeKey === key ? store.getState().chat : store.getState().chat.parked[key]).messages.at(-1).approval;

  const visible = fresh();
  visible.dispatch({ ...slice.answerGraphEvent(event), meta: { key: 'chat:g1', visible: true } });
  assert.equal(approvalOf(visible).popup, true);

  const hidden = fresh();
  hidden.dispatch({ ...slice.answerGraphEvent(event), meta: { key: 'chat:g1', visible: false } });
  assert.equal(approvalOf(hidden).popup, false, 'a hidden tab gets the inline card only');

  const away = fresh();
  away.dispatch(actions.fetchConversation.pending('load-2', { chatId: 'g2' }));
  away.dispatch({ ...slice.answerGraphEvent(event), meta: { key: 'chat:g1', visible: true } });
  assert.equal(approvalOf(away).popup, false, 'another chat on screen: inline card only');

  // Without a DOM (server render) the popup renders nothing, and the card is still there.
  const message = { ...approvalOf(visible) && visible.getState().chat.messages.at(-1), streaming: false };
  assert.match(textOf(bubble(message)), /Allow web search/);
});

const twoHops = [
  { id: 'h2', task: 'find the USD to EUR rate', dependsOn: [], source: 'web' },
  { id: 'h3', task: 'find the USD to INR rate', dependsOn: [], source: 'web' },
];
const agentEvents = [
  { type: 'approval_result', approved: true },
  { type: 'agent_start', agentId: 'web-h2', agent: 'Web research', hopId: 'h2', task: twoHops[0].task },
  { type: 'agent_start', agentId: 'web-h3', agent: 'Web research', hopId: 'h3', task: twoHops[1].task },
  { type: 'agent_step', agentId: 'web-h3', hopId: 'h3', step: 1, tool: 'web_search', args: { query: 'USD INR today' }, ok: true },
  { type: 'agent_step', agentId: 'web-h2', hopId: 'h2', step: 1, tool: 'web_search', args: { query: 'USD EUR today' }, ok: true },
  { type: 'agent_step', agentId: 'web-h2', hopId: 'h2', step: 2, tool: 'read_page', args: { url: 'https://fx.example/eur' }, ok: true },
  { type: 'agent_finish', agentId: 'web-h3', hopId: 'h3', failed: true, reason: 'timeout' },
];
const asSteps = (events) => events.map((event) => ({ kind: event.type, event }));

test('several agents run at once: their interleaved events are grouped by agentId', () => {
  const trace = web.buildWebTrace(asSteps(agentEvents));
  assert.deepEqual(trace.agents.map((agent) => [agent.id, agent.task, agent.calls.length, agent.running]), [
    ['web-h2', 'find the USD to EUR rate', 2, true],
    ['web-h3', 'find the USD to INR rate', 1, false],
  ]);
  assert.equal(web.agentLabel(trace.agents[0]), 'Reading: https://fx.example/eur');
  assert.equal(web.liveWebLabel(trace), 'Reading: https://fx.example/eur', 'one still running: its latest step');
  assert.equal(web.liveWebLabel(web.buildWebTrace(asSteps(agentEvents.slice(0, 5)))), 'Searching the web · 2 agents');

  const panel = textOf(renderToStaticMarkup(createElement(StepByStep, { trace: buildAnswerTrace(asSteps(agentEvents)), steps: [], streaming: false })));
  assert.match(panel, /Web research: find the USD to EUR rate Searched “USD EUR today”/);
  assert.match(panel, /Web research: find the USD to INR rate Searched “USD INR today”[^]*This search failed: timeout/);
});

test('"● N agents working" below the input, with each agent\'s task and latest step', async () => {
  const { default: LiveAgents } = await vite.ssrLoadModule('/src/components/chat/LiveAgents.jsx');
  const { RunningAgents } = await vite.ssrLoadModule('/src/components/chat/WebSearch.jsx');
  const live = { id: 'a1', role: 'assistant', streaming: true, steps: asSteps(agentEvents) };
  assert.match(textOf(renderToStaticMarkup(createElement(LiveAgents, { messages: [live] }))), /1 agent working/);
  assert.match(textOf(renderToStaticMarkup(createElement(LiveAgents, { messages: [{ ...live, steps: asSteps(agentEvents.slice(0, 6)) }] }))), /2 agents working/);
  assert.equal(renderToStaticMarkup(createElement(LiveAgents, { messages: [{ ...live, streaming: false }] })), '', 'hidden once done');
  assert.equal(renderToStaticMarkup(createElement(LiveAgents, { messages: [{ ...live, steps: [] }] })), '');

  // Collapsed until clicked.
  const agents = web.buildWebTrace(asSteps(agentEvents)).agents;
  const html = renderToStaticMarkup(createElement(RunningAgents, { agents }));
  assert.match(html, /aria-expanded="false"/);
});

test('saved webFacts.results: every page once, the date, and "Web search failed for: <task>"', () => {
  const message = { id: 'a', role: 'assistant', content: 'Answer.', metadata: { webApproval: true, webFacts: {
    searchedAt: '2026-11-14T09:30:00.000Z',
    results: [
      { hopId: 'h2', task: 'find the current USD to EUR rate', answer: '1 USD = 0.86 EUR', sources: ['https://fx.example/a', 'https://fx.example/b'], stopReason: 'done' },
      { hopId: 'h4', task: 'find the current USD to GBP rate', answer: '1 USD = 0.75 GBP', sources: ['https://fx.example/b'], stopReason: 'step_limit' },
      { hopId: 'h3', task: 'find the current USD to INR rate', answer: '', sources: [], stopReason: 'failed' },
    ],
  } } };
  const facts = web.messageWebFacts(message);
  assert.deepEqual(facts.sources, ['https://fx.example/a', 'https://fx.example/b']);
  assert.deepEqual(facts.failures, ['find the current USD to INR rate']);
  const html = textOf(bubble(message));
  assert.match(html, /Web search failed for: find the current USD to INR rate/);
  assert.match(html, /fx\.example\/a fx\.example\/b Searched on/);

  const allFailed = { ...message, metadata: { webFacts: { searchedAt: null, results: [{ task: 'find X', answer: '', sources: [], stopReason: 'failed' }] } } };
  const failedHtml = textOf(bubble(allFailed));
  assert.match(failedHtml, /Web search failed for: find X/);
  assert.doesNotMatch(failedHtml, /Web sources/);
});
