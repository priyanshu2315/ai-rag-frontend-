import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import {
  filterPhases, groupByMonth, monthOf, newestIds, normalizePipeline, orderPhases, previewText,
} from '../src/utils/pipelineTimeline.js';

let vite, TimelineView, reducer, actions, client;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ TimelineView } = await vite.ssrLoadModule('/src/components/about/EngineeringTimeline.jsx'));
  ({ default: reducer } = await vite.ssrLoadModule('/src/redux/slices/pipelineSlice.js'));
  actions = await vite.ssrLoadModule('/src/redux/actions/pipelineActions.js');
  ({ default: client } = await vite.ssrLoadModule('/src/redux/axiosClient.js'));
});
after(async () => vite?.close());

const phase = (id, date, fields = {}) => ({
  id, date, title: `Phase ${id}`, problem: `Problem ${id} `.repeat(20).trim(), solution: `Solution ${id}`, terms: [], ...fields,
});

// Backend order, with an id gap and a date out of sequence (id 3), as the live data has.
const payload = { total: 6, phases: [
  phase(1, 'August 22, 2026', { terms: ['Inference Offloading'] }),
  phase(3, 'September 6, 2026', { terms: ['Hybrid Search'] }),
  phase(4, 'August 25, 2026', { title: 'Lexical Indexing', terms: ['Hybrid Search', 'BM25'] }),
  phase(41, 'September 27, 2026'),
  phase(59, 'November 4, 2026', { solution: 'Cross-Encoder reranking' }),
  phase(62, 'November 7, 2026'),
] };
const { phases } = normalizePipeline(payload);

test('normalises the payload and keeps backend order, never sorting by id', () => {
  assert.deepEqual(phases.map((item) => item.id), [1, 3, 4, 41, 59, 62]);
  assert.equal(normalizePipeline(payload).total, 6);
  assert.deepEqual(normalizePipeline({ phases: [null, { title: 'no id' }, { id: 9, terms: ['ok', 3] }] }),
    { total: 1, phases: [{ id: 9, title: '', problem: '', solution: '', terms: ['ok'], date: '' }] });
  assert.deepEqual(orderPhases(phases, 'newest').map((item) => item.id), [62, 59, 41, 4, 3, 1]);
  assert.deepEqual(newestIds(phases), [41, 59, 62]);
});

test('groups by month in order of first appearance without repeating a heading', () => {
  assert.equal(monthOf('November 7, 2026'), 'November 2026');
  assert.equal(monthOf('soon'), 'Undated');
  const oldest = groupByMonth(phases);
  assert.deepEqual(oldest.map((group) => group.month), ['August 2026', 'September 2026', 'November 2026']);
  assert.deepEqual(oldest[0].phases.map((item) => item.id), [1, 4]);
  assert.deepEqual(oldest[1].phases.map((item) => item.id), [3, 41]);
  assert.deepEqual(groupByMonth(orderPhases(phases, 'newest')).map((group) => group.month), ['November 2026', 'September 2026', 'August 2026']);
});

test('search covers title, problem, solution and terms case-insensitively; a term narrows further', () => {
  assert.deepEqual(filterPhases(phases, { query: 'lexical' }).map((item) => item.id), [4]);
  assert.deepEqual(filterPhases(phases, { query: 'CROSS-encoder' }).map((item) => item.id), [59]);
  assert.deepEqual(filterPhases(phases, { query: 'bm25' }).map((item) => item.id), [4]);
  assert.deepEqual(filterPhases(phases, { query: 'problem 41' }).map((item) => item.id), [41]);
  assert.deepEqual(filterPhases(phases, { term: 'Hybrid Search' }).map((item) => item.id), [3, 4]);
  assert.deepEqual(filterPhases(phases, { term: 'Hybrid Search', query: 'lexical' }).map((item) => item.id), [4]);
  assert.deepEqual(filterPhases(phases, { query: '   ' }).length, 6);
});

test('previews cut near 140 characters at a word boundary', () => {
  const text = 'word '.repeat(60).trim();
  const preview = previewText(text);
  assert.ok(preview.length <= 141 && preview.endsWith('…'));
  assert.ok(!preview.slice(0, -1).endsWith(' '));
  assert.equal(previewText('short'), 'short');
});

test('renders newest first under month headings, with the newest three expanded', () => {
  const html = renderToStaticMarkup(createElement(TimelineView, { phases, total: 6, status: 'succeeded' }));
  assert.match(html, /Showing 6 of 6/);
  assert.ok(html.indexOf('November 2026') < html.indexOf('September 2026'));
  assert.ok(html.indexOf('Phase 62') < html.indexOf('Phase 59'));
  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 3);
  assert.equal((html.match(/aria-expanded="false"/g) ?? []).length, 3);
  assert.match(html, /Problem<\/p>/);
  assert.match(html, /aria-pressed="true"[^>]*>Newest first/);
  assert.match(html, /type="search"/);
});

test('loading, error and empty states', () => {
  const loading = renderToStaticMarkup(createElement(TimelineView, { phases: [], total: 0, status: 'loading' }));
  assert.equal((loading.match(/\bshimmer\b/g) ?? []).length, 9, 'three skeleton cards');
  const failed = renderToStaticMarkup(createElement(TimelineView, { phases: [], total: 0, status: 'failed', error: 'Server down', onRetry: () => {} }));
  assert.match(failed, /Server down/);
  assert.match(failed, /Try again/);
  const empty = renderToStaticMarkup(createElement(TimelineView, { phases: [], total: 0, status: 'succeeded' }));
  assert.match(empty, /No matching entries/);
});

test('fetches once from /pipeline and keeps it for the session; an aborted request is not an error', async () => {
  const { configureStore } = await import('@reduxjs/toolkit');
  const store = configureStore({ reducer: { pipeline: reducer } });
  const prior = client.defaults.adapter;
  const calls = [];
  client.defaults.adapter = async (config) => {
    calls.push(config.url);
    return { data: payload, status: 200, statusText: 'OK', headers: {}, config };
  };
  try {
    await store.dispatch(actions.fetchPipeline());
    assert.deepEqual(calls, ['/pipeline']);
    const state = store.getState().pipeline;
    assert.equal(state.status, 'succeeded');
    assert.deepEqual(state.phases.map((item) => item.id), [1, 3, 4, 41, 59, 62]);

    const fresh = configureStore({ reducer: { pipeline: reducer } });
    const promise = fresh.dispatch(actions.fetchPipeline());
    promise.abort();
    await promise;
    assert.equal(fresh.getState().pipeline.status, 'idle');
    assert.equal(fresh.getState().pipeline.error, null);
  } finally {
    client.defaults.adapter = prior;
  }
});
