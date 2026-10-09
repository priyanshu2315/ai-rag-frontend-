import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { emptyStructure } from '../src/utils/structuredInspector.js';

let vite;
let ProcessingUsage;
before(async () => {
  vite = await createServer({ configFile: false, server: { middlewareMode: true, ws: false, watch: null }, appType: 'custom' });
  ({ default: ProcessingUsage } = await vite.ssrLoadModule('/src/components/documents/ProcessingUsage.jsx'));
});
after(async () => vite?.close());

test('refresh states that unpersisted Gemini usage is unavailable instead of zero', () => {
  const html = renderToStaticMarkup(createElement(ProcessingUsage, {
    filename: 'old.pdf', structure: emptyStructure(), refreshed: true,
  }));
  assert.match(html, /Gemini usage unavailable after refresh/);
  assert.doesNotMatch(html, /Gemini input tokens.*0/);
  assert.match(html, /Local embedding.*no per-token API charge/);
});

test('logic mode says no Gemini extraction call was observed and avoids claiming zero processing cost', () => {
  const structure = { ...emptyStructure(), provider: 'llamaparse' };
  const html = renderToStaticMarkup(createElement(ProcessingUsage, { filename: 'logic.pdf', structure }));
  assert.match(html, /No Gemini extraction call observed/);
  assert.doesNotMatch(html, /total document cost/i);
});

