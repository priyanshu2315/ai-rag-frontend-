import assert from 'node:assert/strict';
import { test } from 'node:test';
import { citationLabel, parseCitations, resolveCitation, sourceDocuments, summarizeTrace } from '../src/utils/crag.js';
import remarkCitations from '../src/utils/remarkCitations.js';

test('citations parse page spans, section breadcrumbs and optional document titles', () => {
  const citations = parseCitations('A [p1: Page 4], B [p2: Page 3-4 (5. Financial record)], C [p3: Depot Handbook, Page 3–4 (5. Financial record)].');
  assert.equal(citations.length, 3);
  assert.equal(citations[0].sourceId, 'p1');
  assert.equal(citations[1].pageEnd, 4);
  assert.equal(citations[2].documentTitle, 'Depot Handbook');
  assert.equal(citationLabel(citations[2]), 'Page 3–4 · 5. Financial record');
  assert.equal(parseCitations('[Source ID: Page 4]')[0].sourceId, 'Source ID');
  assert.deepEqual(parseCitations('[link](https://example.com) [x: nope]'), []);
});

test('citation binding uses final sources and never guesses another document by page', () => {
  const finalParent = { id: 'p2', documentId: 'd2', text: 'Final passage', metadata: { document_title: 'Depot Handbook' } };
  const sources = sourceDocuments([
    { kind: 'retrieval_candidates', event: { documents: [{ id: 'p1', documentId: 'd1' }] } },
    { kind: 'generation_context', event: { documents: [finalParent] } },
  ]);
  assert.equal(resolveCitation(parseCitations('[p2: Depot Handbook, Page 3-4]')[0], sources), finalParent);
  assert.equal(resolveCitation(parseCitations('[p1: Page 4]')[0], sources), null);
  assert.equal(resolveCitation(parseCitations('[p2: Wrong title, Page 4]')[0], sources), null);
  assert.equal(resolveCitation(parseCitations('[p2: Page 4]')[0], [finalParent, { ...finalParent, documentId: 'd3' }]), null);
  assert.equal(resolveCitation(parseCitations('[p2: Page 4]')[0], sourceDocuments([])), null);
});

test('Markdown citation transform preserves code and links, including nested formatted text', () => {
  const tree = { type: 'root', children: [{ type: 'paragraph', children: [
    { type: 'text', value: 'Answer [p1: Page 4].' },
    { type: 'inlineCode', value: '[p2: Page 5]' },
    { type: 'link', url: 'https://example.com', children: [{ type: 'text', value: '[p3: Page 6]' }] },
    { type: 'strong', children: [{ type: 'text', value: '[p4: Page 7]' }] },
  ] }] };
  remarkCitations()(tree);
  const children = tree.children[0].children;
  assert.equal(children[1].data.hProperties['data-source-citation'], '[p1: Page 4]');
  assert.equal(children[3].type, 'inlineCode');
  assert.equal(children[4].url, 'https://example.com');
  assert.equal(children[5].children[0].type, 'link');
});

test('trace follows missing-fact rewriting into round two and counts unique context origins', () => {
  const steps = [
    { kind: 'tool_finish', label: 'Intent Classifier', event: { intent: 'search' } },
    { kind: 'tool_finish', label: 'Question Splitter', event: { queries: ['Depot D08 cost?', 'Depot D08 fiscal year?'] } },
    { kind: 'retrieval_candidates', event: { attempt: 1, query: 'Depot D08 cost?' } },
    { kind: 'grading_result', event: { attempt: 1, decisions: [{ relevant: true, reason: 'Missing fiscal year' }] } },
    { kind: 'tool_finish', label: 'Query Rewriter', event: { query: 'Depot D08 fiscal 2023 operating cost' } },
    { kind: 'retrieval_candidates', event: { attempt: 2, query: 'Depot D08 fiscal 2023 operating cost' } },
    { kind: 'grading_result', event: { attempt: 2 } },
    { kind: 'generation_context', event: { intent: 'search', documents: [
      { id: 'p1', documentId: 'd1', retrievalOrigin: { type: 'search' } },
      { id: 'p2', documentId: 'd1', retrievalOrigin: { type: 'table_continuation' } },
      { id: 'p2', documentId: 'd1', retrievalOrigin: { type: 'table_continuation' } },
      { id: 'p3', documentId: 'd1', retrievalOrigin: { type: 'section_expansion' } },
      { id: 'p4', documentId: 'd1', retrievalOrigin: { type: 'neighbor_expansion' } },
    ] } },
  ];
  const trace = summarizeTrace(steps);
  assert.equal(trace.intentBadge, 'Search');
  assert.equal(trace.queries.length, 2);
  assert.deepEqual(trace.timeline.map((item) => item.kind), ['round', 'follow_up', 'round']);
  assert.deepEqual(trace.rounds[1].stages, ['Search', 'Graded']);
  assert.equal(trace.expansionCount, 3);
  assert.deepEqual(trace.counts, { search: 1, chapter_expansion: 0, table_continuation: 1, section_expansion: 1, section_sibling: 0, section_lead: 0, neighbor_expansion: 1, reference_following: 0 });
  assert.equal(summarizeTrace([{ kind: 'tool_finish', event: { intent: 'page', pageNumber: 7 } }]).intentBadge, 'Page 7');
});
