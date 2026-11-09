import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { readableChunkText, textStats } from '../src/utils/chunkText.js';

let vite, ChunkViewerContent, AnswerTimeline, SearchInspectorContent;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ ChunkViewerContent } = await vite.ssrLoadModule('/src/components/chunks/ChunkViewer.jsx'));
  ({ default: AnswerTimeline } = await vite.ssrLoadModule('/src/components/chat/AnswerTimeline.jsx'));
  ({ SearchInspectorContent } = await vite.ssrLoadModule('/src/components/chat/SearchInspector.jsx'));
});
after(async () => vite?.close());

test('clean text rejoins wrapped lines but keeps real breaks, lists and tables', () => {
  assert.equal(readableChunkText('The depot reported its\noperating cost for the\nfiscal year.'), 'The depot reported its operating cost for the fiscal year.');
  assert.equal(readableChunkText('Costs were restated after infor-\nmation arrived.'), 'Costs were restated after infor-mation arrived.');
  // One fact per line stays one per line (a markdown hard break), not a run-on paragraph.
  assert.equal(readableChunkText('Census, 1 January 2022: 158,744\nCity proper, 2023: 163,482'), 'Census, 1 January 2022: 158,744  \nCity proper, 2023: 163,482');
  assert.equal(readableChunkText('Para one.\n\n\n\nPara   two.'), 'Para one.\n\nPara two.');
  assert.equal(readableChunkText('Steps:\n- first\n- second'), 'Steps:\n- first\n- second');
  assert.equal(readableChunkText('# Costs\nnext line'), '# Costs  \nnext line');
  const table = '| Depot | Cost |\n| --- | --- |\n| D01   | 3,880 |';
  assert.equal(readableChunkText(table), table);
  assert.equal(readableChunkText('Line one<br/>line two <b>bold</b>'), 'Line one line two bold');
  assert.equal(readableChunkText(null), '');
  assert.deepEqual(textStats('two words'), { characters: 9, words: 2 });
});

const chunk = {
  id: 'chunk-42', page: 3, heading: 'Costs › D08',
  text: '| Depot | Cost |\n| --- | --- |\n| **D08** | 4,120 |\n\nThe figure was\nrestated <script>alert(1)</script>',
  searchText: 'D08 4120 restated',
  meta: [['Status', 'Used'], ['Rank', '#2 → #1'], ['Empty', null]],
};

test('Clean renders the text as formatted prose and tables, with HTML stripped', () => {
  const html = renderToStaticMarkup(createElement(ChunkViewerContent, { chunk, view: 'clean', onView: () => {} }));
  assert.match(html, /<table/);
  assert.match(html, /<strong[^>]*>D08<\/strong>/);
  assert.match(html, /The figure was restated/);
  assert.doesNotMatch(html, /<script|alert\(1\)<\/script/);
  assert.match(html, /aria-pressed="true"[^>]*>Clean/);
  assert.match(html, /<dt[^>]*>Status<\/dt><dd[^>]*>Used/);
  assert.doesNotMatch(html, />Empty</, 'blank meta rows are dropped');
  assert.doesNotMatch(html, /Search text/, 'search text belongs to the raw view');
});

test('Raw shows the exact text, escaped, plus the differing search text', () => {
  const html = renderToStaticMarkup(createElement(ChunkViewerContent, { chunk, view: 'raw', onView: () => {} }));
  assert.match(html, /<pre[^>]*>\| Depot \| Cost \|/);
  assert.match(html, /\*\*D08\*\*/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Search text/);
  assert.match(html, /D08 4120 restated/);
  assert.match(html, /aria-label="Copy raw text"/);
  const empty = renderToStaticMarkup(createElement(ChunkViewerContent, { chunk: { id: 'x' }, view: 'raw', onView: () => {} }));
  assert.match(empty, /No text was recorded for this chunk/);
});

const doc = (id, page, fields = {}) => ({ id, text: `Passage ${id}`, metadata: { page_number: page, heading_path: ['Costs'] }, ...fields });
const steps = [
  { type: 'tool_finish', tool: 'Question Splitter', queries: ['cost'] },
  { type: 'retrieval_candidates', attempt: 1, query: 'cost', documents: [doc('a', 1, { retrievalRank: 1, matchedBy: ['vector'] }), doc('b', 2, { retrievalRank: 2 })] },
  { type: 'rerank_result', attempt: 1, query: 'cost', documents: [{ ...doc('a', 1), rerankRank: 1, rerankScore: 0.9 }] },
  { type: 'grading_result', attempt: 1, keptParentIds: ['a'], stopReason: 'enough' },
  { type: 'generation_context', intent: 'search', documents: [doc('a', 1)] },
].map((event, index) => ({ id: index, event }));

test('every chunk row in the steps card and the Search Inspector has a View button', () => {
  const final = renderToStaticMarkup(createElement(AnswerTimeline, { steps, streaming: false, defaultOpen: true }));
  assert.equal((final.match(/aria-label="View chunk a"/g) ?? []).length, 1, 'final chunks');
  const live = renderToStaticMarkup(createElement(AnswerTimeline, { steps: steps.slice(0, 4), streaming: true }));
  assert.match(live, /aria-label="View chunk a"/, 'found chunks in a round');
  assert.match(live, /aria-label="View chunk b"/);
  const inspector = renderToStaticMarkup(createElement(SearchInspectorContent, { steps }));
  assert.match(inspector, /aria-label="View chunk a"/);
});
