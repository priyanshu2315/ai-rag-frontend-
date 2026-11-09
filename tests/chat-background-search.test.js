import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite, reducer, slice, actions;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  slice = await vite.ssrLoadModule('/src/redux/slices/chatSlice.js');
  reducer = slice.default;
  actions = await vite.ssrLoadModule('/src/redux/actions/chatActions.js');
});
after(async () => vite?.close());

const conversation = (id, messages = []) => ({ id, messages });
const run = (state, ...list) => list.reduce((current, action) => reducer(current, action), state);
const open = (state, requestId, documentId, id) => run(state,
  actions.fetchConversation.pending(requestId, documentId),
  actions.fetchConversation.fulfilled(conversation(id), requestId, documentId));
const ask = (state, documentId, requestId) => run(state,
  slice.askedQuestion('What is the cost?'),
  actions.askQuestion.pending(requestId, { question: 'What is the cost?', documentId }),
  { ...slice.answerStarted(), meta: { key: slice.contextKey(documentId) } });
// What the stream does: events tagged with the context they were asked in.
const emit = (state, event, documentId) => {
  let next = state;
  actions.applyEvent((action) => { next = reducer(next, action); }, event, slice.contextKey(documentId));
  return next;
};
const finished = (requestId, documentId) => actions.askQuestion.fulfilled({ answer: 'x' }, requestId, { question: 'q', documentId });

test('an answer still searching survives a trip to another document and shows where it got to', () => {
  let state = open(undefined, 'c1', 'A', 'conv-A');
  state = ask(state, 'A', 'ask-A');
  state = emit(state, { type: 'tool_finish', tool: 'Question Splitter', queries: ['q1'] }, 'A');

  // Leave for document B while A is mid-search.
  state = run(state, actions.fetchConversation.pending('c2', 'B'));
  assert.equal(state.activeKey, 'B');
  assert.equal(state.messages.length, 0, 'B starts empty; A is not shown there');
  assert.equal(state.sending, false);
  assert.ok(state.parked.A.sending);

  // A keeps streaming in the background, and B's chat is untouched.
  state = emit(state, { type: 'retrieval_candidates', attempt: 1, query: 'q1', documents: [{ id: 'x', text: 't' }] }, 'A');
  assert.equal(state.messages.length, 0);
  state = run(state, actions.fetchConversation.fulfilled(conversation('conv-B', [{ id: 'm', role: 'assistant', content: 'B history' }]), 'c2', 'B'));
  assert.equal(state.messages[0].content, 'B history');
  assert.equal(state.conversationId, 'conv-B');
  state = emit(state, { type: 'tool_start', tool: 'Hybrid Search', query: 'q1' }, 'A');
  assert.equal(state.messages.length, 1, 'still only B history');

  // Back to A: the in-flight answer is restored, and the server copy does not wipe it.
  state = run(state, actions.fetchConversation.pending('c3', 'A'));
  assert.equal(state.activeKey, 'A');
  assert.equal(state.sending, true);
  assert.equal(state.loading, false);
  assert.equal(state.parked.A, undefined);
  state = run(state, actions.fetchConversation.fulfilled(conversation('conv-A', []), 'c3', 'A'));
  assert.equal(state.conversationId, 'conv-A');
  const [question, answer] = state.messages;
  assert.equal(question.role, 'user');
  assert.equal(answer.streaming, true);
  assert.deepEqual(answer.steps.map((step) => step.kind), ['tool_finish', 'retrieval_candidates', 'tool_start']);

  // It goes on streaming into the visible chat, then finishes normally.
  state = emit(state, { type: 'token', text: 'It costs 5.' }, 'A');
  state = run(state, finished('ask-A', 'A'));
  assert.equal(state.sending, false);
  assert.equal(state.messages[1].content, 'It costs 5.');
  assert.equal(state.messages[1].streaming, false);
});

test('an answer that finishes in the background settles there; a finished one is re-read from the server', () => {
  let state = open(undefined, 'c1', 'A', 'conv-A');
  state = ask(state, 'A', 'ask-A');
  state = run(state, actions.fetchConversation.pending('c2', 'B'));
  state = emit(state, { type: 'token', text: 'Done.' }, 'A');
  state = run(state, finished('ask-A', 'A'));
  assert.equal(state.parked.A.sending, false);
  assert.equal(state.parked.A.messages[1].streaming, false);
  assert.equal(state.sending, false, 'B is never marked sending by A finishing');

  state = run(state, actions.fetchConversation.pending('c3', 'A'));
  assert.equal(state.loading, true, 'a finished answer comes from the server instead');
  assert.equal(state.parked.A, undefined);
  state = run(state, actions.fetchConversation.fulfilled(conversation('conv-A', [{ id: 's', role: 'assistant', content: 'Saved.' }]), 'c3', 'A'));
  assert.equal(state.messages[0].content, 'Saved.');
});

test('a background answer that fails ends there without surfacing in the visible chat', () => {
  let state = open(undefined, 'c1', 'A', 'conv-A');
  state = ask(state, 'A', 'ask-A');
  state = emit(state, { type: 'tool_finish', tool: 'Question Splitter', queries: ['q'] }, 'A');
  state = open(state, 'c2', 'B', 'conv-B');
  state = run(state, actions.askQuestion.rejected(new Error('Network'), 'ask-A', { question: 'q', documentId: 'A' }, { message: 'Connection lost', retryable: true }));
  assert.equal(state.error, null, 'A error is not shown in B');
  assert.equal(state.parked.A.sending, false);
  assert.equal(state.parked.A.messages[1].interrupted, true);
  assert.equal(state.parked.A.error, 'Connection lost');
});

test('events for a discarded context are dropped, and unkeyed events still hit the visible chat', () => {
  let state = open(undefined, 'c1', 'A', 'conv-A');
  state = emit(state, { type: 'token', text: 'late' }, 'gone');
  assert.equal(state.messages.length, 0);
  state = ask(state, 'A', 'ask-A');
  actions.applyEvent((action) => { state = reducer(state, action); }, { type: 'token', text: 'hi' });
  assert.equal(state.messages[1].content, 'hi');
});
