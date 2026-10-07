import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

let vite;
let ParentChunkRow;
let EmbeddingInspection;

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  ({ default: ParentChunkRow } = await vite.ssrLoadModule('/src/components/chunks/ParentChunkRow.jsx'));
  ({ default: EmbeddingInspection } = await vite.ssrLoadModule('/src/components/chunks/EmbeddingInspection.jsx'));
});

test('stored embedding viewer uses returned diagnostics and numeric values', () => {
  const html = renderToStaticMarkup(createElement(EmbeddingInspection, {
    child: {
      embedding: [0.25, -0.5, 0.75],
      embeddingDimensions: 3,
      metadata: { embedding: { model: 'test-model', tokenCount: 9, tokenLimit: 16, withinLimit: true, dimensions: 3 } },
    },
  }));
  assert.match(html, /test-model/);
  assert.match(html, /Full stored vector \(3 values\)/);
  assert.doesNotMatch(html, /0.25/);
  assert.doesNotMatch(html, /-0.5/);
  assert.doesNotMatch(html, /0.75/);
});

after(async () => vite?.close());

test('inspector labels omitted stored fields and preserves exact returned text', () => {
  const html = renderToStaticMarkup(createElement(ParentChunkRow, {
    chunk: { id: 'parent-1', text: 'Original passage', metadata: { page_number: 2, chunk_index: 5 } },
    index: 0,
    open: true,
    entry: {
      loading: false,
      items: [{ id: 'child-1', text: 'Child passage', metadata: { page_number: 2, child_index: 1 } }],
      totalChildren: 3,
      response: { totalChildren: 3, children: [] },
    },
    onToggle: () => {},
    onRetry: () => {},
    onNavigate: () => {},
    parentById: new Map(),
  }));
  assert.match(html, /Original passage/);
  assert.match(html, /Child passage/);
  assert.match(html, /1 loaded \/ 3 total/);
  assert.match(html, /Unavailable from this API response/);
  assert.match(html, /Previous parent: <\/span>Unavailable from API/);
});
