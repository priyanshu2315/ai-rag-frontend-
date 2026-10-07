import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { emptyStructure } from '../src/utils/structuredInspector.js';

let vite, SourcePages, StructureOverview, Relationships;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: SourcePages } = await vite.ssrLoadModule('/src/components/documents/SourcePages.jsx'));
  ({ default: StructureOverview } = await vite.ssrLoadModule('/src/components/documents/StructureOverview.jsx'));
  ({ Relationships } = await vite.ssrLoadModule('/src/components/chunks/StructuredDetails.jsx'));
});
after(async () => vite?.close());

test('source viewer provides escaped raw text and safe Markdown without executing HTML or unsafe URLs', () => {
  const html = renderToStaticMarkup(createElement(SourcePages, { pages: [{ id: 'rendered-1', number: null,
    source: { id: 'rendered-1', kind: 'rendered_page', parserPageNumber: 2, sequenceIndex: 1, sourcePageNumber: null }, headings: [], fences: [],
    text: '**Kettleby** <script>alert(1)</script> [bad](javascript:alert%281%29)', parserItemCount: null }] }));
  assert.match(html, /Rendered source rendered-1/);
  assert.match(html, /parserPage/);
  assert.match(html, /Unavailable/);
  assert.match(html, /<strong[^>]*>Kettleby<\/strong>/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /Page 0/);
});

test('refresh labels extraction, heading, section part and replay provenance accurately', () => {
  const html = renderToStaticMarkup(createElement(StructureOverview, { structure: emptyStructure(), documentId: 'd1',
    parents: [{ id: 'p1', documentId: 'd1', metadata: null }], childEntries: {}, parentById: new Map(), status: 'COMPLETED', summaryStatus: 'FAILED' }));
  assert.match(html, /Original extraction: Unavailable/);
  assert.match(html, /Heading event history: Unavailable/);
  assert.match(html, /Section-part history: Unavailable/);
  assert.match(html, /backend provides no replay/);
  assert.match(html, /Summary: FAILED/);
});

test('unresolved explicit explanation has independent navigation and never asserts confirmation', () => {
  const html = renderToStaticMarkup(createElement(Relationships, { references: [{ relation: 'explains', targetLabel: '5', status: 'unresolved', targetParentIds: ['p5'], evidence: { text: 'Section 5A explains 5' } }], parentById: new Map([['p5', { id: 'p5' }]]) }));
  assert.match(html, /explains: 5/);
  assert.match(html, /Go to p5 \(unresolved\)/);
  assert.doesNotMatch(html, /Previous parent/);
});
