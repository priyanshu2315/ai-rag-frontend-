import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { buildAnswerTrace, intentLine, liveStage, stopReasonLabel, summaryLine } from '../src/utils/answerTrace.js';
import { messageSteps } from '../src/utils/messageMetadata.js';

let vite, AnswerTimeline, StepByStep, Developer;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: AnswerTimeline, StepByStep, Developer } = await vite.ssrLoadModule('/src/components/chat/AnswerTimeline.jsx'));
});
after(async () => vite?.close());

const doc = (id, page, fields = {}) => ({ id, text: `Passage ${id} `.repeat(30), metadata: { page_number: page, heading_path: ['Costs', `Section ${id}`] }, ...fields });

const a = doc('a', 4, { retrievalRank: 1, matchedBy: ['vector', 'keyword'] });
const b = doc('b', 2, { retrievalRank: 2, matchedBy: ['vector'] });
const c = doc('c', 9, { retrievalRank: 14, matchedBy: ['identifier'] });
const n = doc('n', 5, { retrievalOrigin: { type: 'section_sibling' } });
const d = doc('d', 7, { retrievalRank: 1, matchedBy: ['phrase'] });

const events = [
  { type: 'status', message: 'Thinking hard' },
  { type: 'tool_start', tool: 'Question Splitter' },
  { type: 'tool_finish', tool: 'Question Splitter', queries: ['D08 cost', 'D08 year'],
    hopPlan: [{ id: 'h1', task: 'Find the D08 cost', dependsOn: [] }, { id: 'h2', task: 'Find its year', dependsOn: ['h1'] }],
    searchTiers: [{ text: 'D08 operating cost', keywords: ['cost'], identifiers: ['D08'], entities: ['Alderbank'] }] },
  // Parallel queries interleave.
  { type: 'retrieval_candidates', attempt: 1, query: 'D08 cost', searchInputs: { text: 'D08 cost', idPatterns: ['D08'] }, documents: [c, b, a] },
  { type: 'retrieval_candidates', attempt: 1, query: 'D08 year', documents: [b] },
  { type: 'rerank_result', attempt: 1, query: 'D08 cost', rerankApplied: true,
    documents: [{ ...c, rerankRank: 1, rerankScore: 0.98 }, { ...a, rerankRank: 2, rerankScore: 0.6 }] },
  { type: 'rerank_result', attempt: 1, query: 'D08 year', rerankApplied: false, documents: [b] },
  { type: 'neighbor_expansion', attempt: 1, seedParentIds: ['c'], addedParentIds: ['n'], documents: [c, n] },
  { type: 'grading_result', attempt: 1, keptParentIds: ['c'], stopReason: '', missingQuery: '',
    decisions: [{ parentId: 'c', relevant: true }, { parentId: 'a', relevant: false }, { parentId: 'b', relevant: false }],
    hopProgress: [{ hopId: 'h1', status: 'resolved', value: '4,120' }, { hopId: 'h2', status: 'pending', reason: 'Year not stated' }],
    gradingResponse: { raw: 'grader said so' } },
  { type: 'tool_finish', tool: 'Query Rewriter', query: 'D08 fiscal year restatement' },
  { type: 'retrieval_candidates', attempt: 2, query: 'D08 fiscal year restatement', documents: [d] },
  { type: 'rerank_result', attempt: 2, query: 'D08 fiscal year restatement', rerankApplied: true, documents: [{ ...d, rerankRank: 1, rerankScore: 0.9 }] },
  { type: 'grading_result', attempt: 2, keptParentIds: ['d'], stopReason: 'no_new_query', decisions: [{ parentId: 'd', relevant: true }],
    hopProgress: [{ hopId: 'h1', status: 'resolved', value: '4,120' }, { hopId: 'h2', status: 'resolved', value: 'FY2023' }] },
  { type: 'generation_context', intent: 'search', documents: [c, n, d], isComplete: true, contextLimited: true,
    contextText: '<document>context</document>', hopProgress: [{ hopId: 'h2', status: 'resolved', value: 'FY2023' }],
    validationWarnings: ['citation p.99 not in context'] },
  { type: 'step_cost', step: 'Relevance Grader', formattedINR: '₹0.01' },
  { type: 'total_usage_summary', formattedTotalCost: '₹0.25', breakdown: [] },
];
const steps = events.map((event, index) => ({ id: `s${index}`, kind: event.type, event, done: true }));

test('ledger keeps the highest status per chunk, with used always winning', () => {
  const trace = buildAnswerTrace(steps);
  const status = Object.fromEntries(trace.chunks.map((chunk) => [chunk.id, chunk.status]));
  assert.deepEqual(status, { c: 'used', b: 'rejected', a: 'rejected', n: 'used', d: 'used' });

  const partial = buildAnswerTrace(steps.slice(0, 8));
  const early = Object.fromEntries(partial.chunks.map((chunk) => [chunk.id, chunk.status]));
  assert.deepEqual(early, { c: 'top', b: 'top', a: 'top', n: 'nearby' });

  const ledgerC = trace.byId.get('c');
  assert.equal(ledgerC.retrievalRank, 14);
  assert.equal(ledgerC.rerankRank, 1);
  assert.deepEqual(ledgerC.matchedBy, ['identifier']);
  assert.deepEqual(trace.byId.get('b').queries, ['D08 cost', 'D08 year']);
  assert.deepEqual(trace.used.map((chunk) => chunk.id), ['n', 'd', 'c'], 'final chunks are sorted by page');
});

test('rounds group by attempt with counts, nearby, checks and decisions', () => {
  const trace = buildAnswerTrace(steps);
  const [one, two] = trace.rounds;
  assert.deepEqual(one.searches.map((search) => [search.query, search.found, search.kept]), [['D08 cost', 3, 2], ['D08 year', 1, 1]]);
  assert.deepEqual(one.searches[0].counts, { vector: 2, identifier: 1, phrase: 0, keyword: 1 });
  assert.equal(one.searches[1].rerankFailed, true);
  assert.equal(one.nearby, 1);
  assert.deepEqual(one.check, { hops: events[8].hopProgress, kept: 1, total: 3 });
  assert.deepEqual(one.decision, { kind: 'rewrite', query: 'D08 fiscal year restatement' });
  assert.deepEqual(two.decision, { kind: 'stop', label: 'No new search idea' });
  assert.equal(trace.final.contextLimited, true);
  assert.equal(summaryLine(trace), '2 rounds · 3 searches · 5 found → 3 used · ₹0.25');
});

test('decisions: follow-up query, explicit stop, and a finished last round', () => {
  const round = (grading, extra = []) => buildAnswerTrace([
    { event: { type: 'retrieval_candidates', attempt: 1, query: 'q', documents: [] } },
    { event: { type: 'grading_result', attempt: 1, ...grading } }, ...extra,
  ]).rounds[0].decision;
  assert.deepEqual(round({ missingQuery: 'find the year' }), { kind: 'follow_up', query: 'find the year' });
  assert.deepEqual(round({ stopReason: 'context_limit' }), { kind: 'stop', label: 'Context limit reached' });
  assert.equal(round({ stopReason: '' }), null, 'live: the next step is not known yet');
  assert.deepEqual(round({ stopReason: '' }, [{ event: { type: 'generation_context', documents: [] } }]), { kind: 'stop', label: 'All tasks answered' });
  assert.deepEqual(round({}, [{ event: { type: 'generation_context', documents: [] } }]), { kind: 'stop', label: 'All tasks answered' });
  assert.equal(stopReasonLabel('planning_failed'), 'Could not plan searches');
  assert.equal(stopReasonLabel('brand_new_reason'), 'brand_new_reason');
});

test('header is collapsed by default with the one-line summary; ignored events never render', () => {
  const html = renderToStaticMarkup(createElement(AnswerTimeline, { steps, streaming: false }));
  assert.match(html, /How this was answered/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /2 rounds · 3 searches · 5 found → 3 used · ₹0.25/);
  assert.doesNotMatch(html, /Thinking hard|Question Splitter|role="tablist"/);
  assert.match(renderToStaticMarkup(createElement(AnswerTimeline, { steps, streaming: true })), /Writing the answer · <\/span>2 rounds/);
});

test('final chunks tab lists only used chunks by page, with provenance and no full text', () => {
  const html = renderToStaticMarkup(createElement(AnswerTimeline, { steps, streaming: false, defaultOpen: true }));
  assert.match(html, /aria-selected="true"[^>]*>Final chunks · 3/);
  assert.ok(html.indexOf('p.5') < html.indexOf('p.7') && html.indexOf('p.7') < html.indexOf('p.9'));
  assert.doesNotMatch(html, /p\.2|p\.4/, 'rejected chunks are not final');
  assert.match(html, /Nearby · neighbor of Section c · round 1/);
  assert.match(html, /Round 1 · “D08 cost”/);
  assert.match(html, /Round 2 · “D08 fiscal year restatement”/);
  assert.match(html, /#14 → #1 \(0\.98\)/);
  assert.match(html, /#1 → #1 \(0\.90\)/);
  assert.match(html, /line-clamp-2/);
  assert.match(html, /Some evidence was cut to fit/);
});

test('step by step: legend, plan chips, rounds with only the last open, and the answer', () => {
  const html = renderToStaticMarkup(createElement(StepByStep, { trace: buildAnswerTrace(steps), streaming: false }));
  for (const text of ['Found by search', 'Kept after rerank', 'Nearby context', 'Rejected by check', 'Used in answer',
    '①', 'Understood', 'Search the documents', 'Tasks', 'Find the D08 cost', 'after h1', 'D08 operating cost',
    'ID</span> D08', 'Name</span> Alderbank', 'Word</span> cost', 'Found 3 → kept 2', 'Vector 2', 'ID 1', 'Words 1',
    'Reranker failed — used search order', '+1 nearby chunk added', 'Check · kept 1 of 3', '✅', '4,120', '⏳', 'Year not stated',
    '↻ Rewriting search: D08 fiscal year restatement', '■ Stopped: No new search idea', '3 chunks used · all tasks answered', '⑤']) {
    assert.ok(html.includes(text), text);
  }
  assert.equal((html.match(/<details open=""/g) ?? []).length, 1, 'only the last round starts open');
  assert.match(html, /<details open=""[^>]*><summary[^>]*><span[^>]*>Round 2</);
});

test('developer tab offers the raw details without rendering them up front', () => {
  const html = renderToStaticMarkup(createElement(Developer, { trace: buildAnswerTrace(steps) }));
  for (const text of ['Search inputs', 'Candidates · scores and ranks · 3', 'Grading response', 'Context text', 'Validation warnings · 1', 'Cost breakdown']) {
    assert.ok(html.includes(text), text);
  }
});

test('non-search intents collapse to one line, live and after replay', () => {
  for (const [intent, pageNumber, line] of [['summary', null, 'Answered from summary'], ['page', 3, 'Answered from page 3'], ['greeting', null, 'Greeting']]) {
    const saved = messageSteps({ id: 'x', metadata: { steps: [{ type: 'generation_context', intent, pageNumber, documents: [] }] } });
    const html = renderToStaticMarkup(createElement(AnswerTimeline, { steps: saved, streaming: false }));
    assert.ok(html.includes(line), line);
    assert.doesNotMatch(html, /How this was answered/);
    assert.equal(intentLine(intent, pageNumber).startsWith(line), true);
  }
});

test('replayed metadata builds the same trace as the live stream', () => {
  const replayed = messageSteps({ id: 'saved', metadata: { steps: events } });
  assert.equal(summaryLine(buildAnswerTrace(replayed)), summaryLine(buildAnswerTrace(steps)));
});

test('live stage follows the stream: plan, search, round work, then the answer', () => {
  const at = (count, options) => liveStage(buildAnswerTrace(steps.slice(0, count)), options);
  assert.deepEqual(at(0), { stage: 'plan', label: 'Understanding the question' });
  assert.deepEqual(at(3), { stage: 'search', label: 'Searching the documents' });
  assert.equal(at(4).label, 'Searching · round 1');
  assert.equal(at(6).label, 'Searching · round 1', 'one parallel query is still unranked');
  assert.equal(at(7).label, 'Ranking results · round 1');
  assert.equal(at(8).label, 'Reading nearby chunks');
  assert.equal(at(9).label, 'Checking the evidence', 'graded; the next step has not arrived');
  assert.equal(at(10).label, 'Planning the next search', 'the rewrite arrived');
  assert.deepEqual(at(12), { stage: 'round', attempt: 2, label: 'Ranking results · round 2' });
  assert.equal(at(13).label, 'Checking the evidence');
  assert.equal(at(13, { writing: true }).label, 'Writing the answer');
  assert.equal(at(14).stage, 'answer');
});

test('a live answer opens on Step by step with the working mark on the current step; a saved one stays collapsed', () => {
  const searching = steps.slice(0, 8);
  const live = renderToStaticMarkup(createElement(AnswerTimeline, { steps: searching, streaming: true }));
  assert.match(live, /aria-expanded="true"/);
  assert.match(live, /aria-selected="true"[^>]*>Step by step/);
  assert.match(live, /aria-label="In progress: Reading nearby chunks"/);
  assert.match(live, /aria-current="step"[^]*?Round 1/);
  assert.equal((live.match(/aria-current="step"/g) ?? []).length, 1);

  const saved = renderToStaticMarkup(createElement(AnswerTimeline, { steps: searching, streaming: false }));
  assert.match(saved, /aria-expanded="false"/);
  assert.doesNotMatch(saved, /In progress|trace-scan/);

  const planned = renderToStaticMarkup(createElement(StepByStep, { trace: buildAnswerTrace(steps.slice(0, 3)), streaming: true,
    live: liveStage(buildAnswerTrace(steps.slice(0, 3))) }));
  assert.match(planned, /aria-current="step"[^]*?Round 1[^]*?Searching…/);
});

test('a final card takes round, query, both ranks and the score from one search', () => {
  const x = doc('x', 3);
  const trace = buildAnswerTrace([
    // q1 ranks x best before reranking, q2 best after: the card must not mix the two.
    { event: { type: 'retrieval_candidates', attempt: 1, query: 'q1', documents: [{ ...x, retrievalRank: 1 }] } },
    { event: { type: 'rerank_result', attempt: 1, query: 'q1', documents: [{ ...x, rerankRank: 3, rerankScore: 0.5 }] } },
    { event: { type: 'retrieval_candidates', attempt: 2, query: 'q2', documents: [{ ...x, retrievalRank: 9 }] } },
    // Same query text in another round is another search.
    { event: { type: 'rerank_result', attempt: 1, query: 'q2', documents: [{ ...x, rerankRank: 1, rerankScore: 0.99 }] } },
    { event: { type: 'rerank_result', attempt: 2, query: 'q2', documents: [{ ...x, rerankRank: 2, rerankScore: 0.876 }] } },
    { event: { type: 'generation_context', intent: 'search', documents: [{ ...x, retrievalOrigin: { type: 'search' } }] } },
  ].map((step, index) => ({ id: index, ...step })));
  assert.deepEqual(trace.byId.get('x').origin, { kind: 'search', round: 1, query: 'q2', retrievalRank: null, rerankRank: 1, rerankScore: 0.99 });

  const html = renderToStaticMarkup(createElement(AnswerTimeline, { steps: [
    { id: 0, event: { type: 'retrieval_candidates', attempt: 1, query: 'q1', documents: [{ ...x, retrievalRank: 1 }] } },
    { id: 1, event: { type: 'rerank_result', attempt: 1, query: 'q1', documents: [{ ...x, rerankRank: 3, rerankScore: 0.5 }] } },
    { id: 2, event: { type: 'retrieval_candidates', attempt: 2, query: 'q2', documents: [{ ...x, retrievalRank: 9 }] } },
    { id: 3, event: { type: 'rerank_result', attempt: 2, query: 'q2', documents: [{ ...x, rerankRank: 2, rerankScore: 0.876 }] } },
    { id: 4, event: { type: 'generation_context', intent: 'search', documents: [x] } },
  ], streaming: false, defaultOpen: true }));
  assert.match(html, /#9 → #2 \(0\.88\)/, 'the rank pair and score of the round 2 search');
  assert.match(html, /Round 2 · “q2”/);
  assert.doesNotMatch(html, /#1 → #2/);
});

test('a nearby final chunk names its seed section and its expansion round, with no search rank', () => {
  const seed = doc('s', 2, { retrievalRank: 1, metadata: { page_number: 2, heading_path: ['Costs', 'Depot table'] } });
  const near = doc('m', 3, { retrievalRank: 4 });
  const trace = buildAnswerTrace([
    { event: { type: 'retrieval_candidates', attempt: 1, query: 'q', documents: [seed, near] } },
    { event: { type: 'rerank_result', attempt: 1, query: 'q', documents: [{ ...seed, rerankRank: 1 }] } },
    { event: { type: 'neighbor_expansion', attempt: 1, seedParentIds: ['other'], addedParentIds: ['m'], documents: [near] } },
    { event: { type: 'neighbor_expansion', attempt: 2, seedParentIds: ['s'], addedParentIds: ['m'], documents: [near] } },
    { event: { type: 'generation_context', intent: 'search', documents: [seed, { ...near, retrievalOrigin: { type: 'table_continuation', seedParentId: 's' } }] } },
  ].map((step, index) => ({ id: index, ...step })));
  assert.deepEqual(trace.byId.get('m').origin, { kind: 'nearby', type: 'table_continuation', seedId: 's', round: 2, seedLabel: 'Depot table' });

  const html = renderToStaticMarkup(createElement(AnswerTimeline, { steps: [
    { id: 0, event: { type: 'retrieval_candidates', attempt: 1, query: 'q', documents: [seed, near] } },
    { id: 1, event: { type: 'neighbor_expansion', attempt: 2, seedParentIds: ['s'], addedParentIds: ['m'], documents: [near] } },
    { id: 2, event: { type: 'generation_context', intent: 'search', documents: [{ ...near, retrievalOrigin: { type: 'section_sibling', seedParentId: 's' } }] } },
  ], streaming: false, defaultOpen: true }));
  assert.match(html, /Nearby · neighbor of Depot table · round 2/);
  assert.doesNotMatch(html, /#4/, 'a nearby card shows no search rank, even when a search also found it');
});

test('found chunks mark what the reranker dropped, only once a rerank actually ran', () => {
  const html = renderToStaticMarkup(createElement(StepByStep, { trace: buildAnswerTrace(steps), streaming: false }));
  // D08 cost: candidates c, b, a; rerank kept c and a. D08 year's rerank failed, so nothing is "dropped" there.
  assert.equal((html.match(/dropped by rerank/g) ?? []).length, 1);
  assert.match(html, /#2<\/span><span[^>]*>dropped by rerank/);
  assert.match(html, /#14 → #1 \(0\.98\)/);
  const live = renderToStaticMarkup(createElement(StepByStep, { trace: buildAnswerTrace(steps.slice(0, 4)), streaming: true }));
  assert.doesNotMatch(live, /dropped by rerank/, 'before the rerank arrives nothing is dropped yet');
});
