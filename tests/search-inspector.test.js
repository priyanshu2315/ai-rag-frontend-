import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  buildSearchInspector, byRerankRank, byRetrievalRank, filterDocuments, finalContext, rankMovement, rankOf,
  sourceSummary, sourcesOf,
} from '../src/utils/searchInspector.js';
import { messageSteps } from '../src/utils/messageMetadata.js';

let vite, SearchInspectorContent;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ SearchInspectorContent } = await vite.ssrLoadModule('/src/components/chat/SearchInspector.jsx'));
});
after(async () => vite?.close());

const doc = (id, fields = {}) => ({ id, text: `Text of ${id}`, metadata: { page_number: 3, heading_path: ['Costs', 'Depots'] }, ...fields });

const both = doc('a', { retrievalRank: 1, retrievalScore: 0.91234, vectorRank: 4, keywordRank: 2, identifierRank: null, phraseRank: null, matchedBy: ['vector', 'keyword'] });
const vectorOnly = doc('b', { retrievalRank: 2, retrievalScore: 0.5, vectorRank: 1, keywordRank: null, matchedBy: ['vector'] });
const idHit = doc('c', { retrievalRank: 14, retrievalScore: 0.2, identifierRank: 1, matchedBy: ['identifier'] });

const events = [
  { type: 'tool_finish', tool: 'Question Splitter', queries: ['D08 cost', 'D08 year'],
    searchTiers: [{ text: 'D08 cost', keywords: ['cost'], identifiers: ['D08'], entities: [] }],
    hopPlan: [{ id: 'h1', task: 'Find cost', dependsOn: [] }, { id: 'h2', task: 'Find year', dependsOn: ['h1'] }] },
  // Parallel queries interleave; the second query's search lands before the first one's rerank.
  { type: 'retrieval_candidates', attempt: 1, query: 'D08 cost', eventId: 'e1',
    searchInputs: { text: 'D08 cost', idPatterns: ['D08'], phraseQuery: '"D08 cost"', wordQuery: 'd08 & cost' },
    documents: [idHit, both, vectorOnly] },
  { type: 'retrieval_candidates', attempt: 1, query: 'D08 year', eventId: 'e2',
    searchInputs: { text: 'D08 year', idPatterns: [], phraseQuery: '', wordQuery: 'year' }, documents: [vectorOnly] },
  { type: 'rerank_result', attempt: 1, query: 'D08 cost', rerankApplied: true, eventId: 'e3',
    documents: [{ ...idHit, rerankRank: 1, rerankScore: 0.987 }, { ...both, rerankRank: 2, rerankScore: 0.4 }] },
  { type: 'rerank_result', attempt: 1, query: 'D08 year', rerankApplied: false, eventId: 'e4', documents: [vectorOnly] },
  { type: 'neighbor_expansion', attempt: 1, seedParentIds: ['c'], addedParentIds: ['n1'], eventId: 'e5',
    documents: [idHit, doc('n1', { retrievalOrigin: { type: 'section_sibling' } })] },
  { type: 'retrieval_candidates', attempt: 2, query: 'D08 fiscal year', eventId: 'e6',
    searchInputs: { text: 'D08 fiscal year', idPatterns: [], phraseQuery: '', wordQuery: 'fiscal' }, documents: [both] },
  { type: 'status', message: 'Grading evidence' },
];
const steps = events.map((event, index) => ({ id: `s${index}`, kind: event.type, event, done: true }));

test('null ranks stay null and sources come from ranks or matchedBy', () => {
  assert.equal(rankOf(both, 'identifier'), null);
  assert.equal(rankOf({ vectorRank: 0 }, 'vector'), null);
  assert.equal(rankOf(both, 'keyword'), 2);
  assert.deepEqual(sourcesOf(both), ['vector', 'keyword']);
  assert.deepEqual(sourcesOf({ matchedBy: ['phrase'] }), ['phrase']);
});

test('events group by attempt then query, keeping first-seen order', () => {
  const model = buildSearchInspector(steps);
  assert.equal(model.available, true);
  assert.deepEqual(model.rounds.map((round) => round.attempt), [1, 2]);
  assert.deepEqual(model.rounds[0].queries.map((group) => group.query), ['D08 cost', 'D08 year']);
  assert.equal(model.rounds[0].queries[0].rerank.eventId, 'e3');
  assert.equal(model.rounds[0].queries[1].rerank.rerankApplied, false);
  assert.equal(model.rounds[0].expansions.length, 1);
  assert.equal(model.rounds[1].queries[0].rerank, null);
  assert.deepEqual(model.plan.hopPlan.map((hop) => hop.id), ['h1', 'h2']);
  assert.ok(model.timeline.some((item) => item.label === 'Grading evidence'));
});

test('ordering, filters, summary and movement', () => {
  assert.deepEqual(byRetrievalRank([idHit, both, vectorOnly]).map((item) => item.id), ['a', 'b', 'c']);
  assert.deepEqual(byRerankRank(events[3].documents).map((item) => item.id), ['c', 'a']);
  assert.deepEqual(filterDocuments([both, vectorOnly, idHit], 'vector').map((item) => item.id), ['b']);
  assert.deepEqual(filterDocuments([both, vectorOnly, idHit], 'several').map((item) => item.id), ['a']);
  assert.deepEqual(filterDocuments([both, vectorOnly, idHit], 'identifier').map((item) => item.id), ['c']);
  assert.deepEqual(sourceSummary([both, vectorOnly, idHit]), {
    counts: { vector: 2, keyword: 1, identifier: 1, phrase: 0 }, several: 1, total: 3,
  });
  assert.equal(rankMovement({ retrievalRank: 14, rerankRank: 1 }).label, '↑ from #14');
  assert.equal(rankMovement({ retrievalRank: 2, rerankRank: 5 }).label, '↓ from #2');
  assert.equal(rankMovement({ retrievalRank: 1, rerankRank: 1 }).label, '= #1');
  assert.equal(rankMovement({ rerankRank: 1 }), null);
});

test('final context puts search hits before added neighbors', () => {
  const { hits, neighbors } = finalContext(events[5]);
  assert.deepEqual(hits.map((item) => item.id), ['c']);
  assert.deepEqual(neighbors.map((item) => item.id), ['n1']);
});

test('renders cards with source badges, inputs and three-decimal scores', () => {
  const html = renderToStaticMarkup(createElement(SearchInspectorContent, { steps, streaming: false }));
  for (const text of ['Round 1', 'Round 2', 'Search plan', 'ID: D08', 'Phrase: &quot;D08 cost&quot;', 'Keyword: d08 &amp; cost',
    'Vector #4', 'Keyword #2', 'ID #1', '0.912', 'page 3', 'Costs › Depots', 'Final context', 'Found by several']) {
    assert.ok(html.includes(text), text);
  }
  // A null rank must never render as zero.
  assert.ok(!html.includes('#0'));
  // Follow-up queries carry no identifier or phrase inputs; that is expected, not an empty chip.
  assert.ok(!html.includes('ID: <'));
});

test('replayed metadata rebuilds the inspector; a bare saved answer says the trace is missing', () => {
  const replayed = messageSteps({ id: 'saved', metadata: { steps: events } });
  assert.equal(buildSearchInspector(replayed).rounds.length, 2);

  const html = renderToStaticMarkup(createElement(SearchInspectorContent, { steps: [], streaming: false }));
  assert.match(html, /Trace not available/);
  const live = renderToStaticMarkup(createElement(SearchInspectorContent, { steps: [], streaming: true }));
  assert.match(live, /Waiting for the first search results/);
});
