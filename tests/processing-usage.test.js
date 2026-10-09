import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyStructureEvent, emptyStructure } from '../src/utils/structuredInspector.js';
import { estimateGeminiCost, summarizeProcessingUsage } from '../src/utils/processingUsage.js';

const usage = { promptTokenCount: 1_000_000, candidatesTokenCount: 100_000,
  thoughtsTokenCount: 20_000, totalTokenCount: 1_120_000 };

test('direct Gemini sequence captures mode, pages and each response batch once', () => {
  let state = emptyStructure();
  const events = [
    { type: 'gemini_extraction_start', documentId: 'd1', model: 'gemini-3.5-flash-lite', visualInput: true, totalBatches: 1, totalSources: 2 },
    { type: 'gemini_extraction_batch_start', documentId: 'd1', batch: 1, sourceIds: ['s1', 's2'] },
    { type: 'gemini_extraction_response', documentId: 'd1', eventId: 'response-1', batch: 1, usage },
    { type: 'gemini_extraction_response', documentId: 'd1', eventId: 'response-duplicate', batch: 1, usage },
    { type: 'gemini_extraction_batch_complete', documentId: 'd1', batch: 1, usage },
    { type: 'gemini_extraction_complete', documentId: 'd1', usage },
    { type: 'page_transcribed', documentId: 'd1', sourceId: 's1', page: 1, text: '# Title' },
    { type: 'extraction_complete', documentId: 'd1', provider: 'gemini', parserJobId: null, totalPages: 2 },
    { type: 'chunking_start', documentId: 'd1', chunkerVersion: 'ai-corrected-markdown-v1' },
  ];
  for (const event of events) state = applyStructureEvent(state, event);
  const result = summarizeProcessingUsage({ usage: state.usage, exchangeRate: 83.5 });
  assert.equal(Object.keys(state.usage.batches).length, 1);
  assert.equal(result.totals.promptTokenCount, 1_000_000);
  assert.equal(result.totals.totalTokenCount, 1_120_000);
  assert.equal(state.provider, 'gemini');
  assert.equal(state.parserJobId, null);
  assert.equal(state.sources.s1.text, '# Title');
  assert.equal(state.chunkerVersion, 'ai-corrected-markdown-v1');
});

test('LlamaParse plus Gemini correction captures corrected/original text and ignores repeated correction totals', () => {
  let state = emptyStructure();
  const events = [
    { type: 'ocr_complete', documentId: 'd1' },
    { type: 'markdown_correction_start', documentId: 'd1', model: 'gemini-3.5-flash-lite', totalBatches: 1 },
    { type: 'markdown_correction_response', documentId: 'd1', batch: 1, usage },
    { type: 'markdown_correction_batch_complete', documentId: 'd1', batch: 1, usage },
    { type: 'markdown_correction_complete', documentId: 'd1', usage },
    { type: 'page_corrected', documentId: 'd1', sourceId: 's1', page: 1, text: '# Corrected', originalText: 'Corrected' },
    { type: 'extraction_complete', documentId: 'd1', provider: 'llamaparse', parserJobId: 'job-1', correction: { batches: [{ batch: 1, usage }] } },
  ];
  for (const event of events) state = applyStructureEvent(state, event);
  assert.equal(summarizeProcessingUsage({ usage: state.usage }).batches.length, 1);
  assert.equal(state.usage.operation, 'correction');
  assert.equal(state.provider, 'llamaparse');
  assert.equal(state.sources.s1.originalText, 'Corrected');
});

test('Gemini list-price estimate prices input and candidate plus thinking output without adding reported total', () => {
  const result = estimateGeminiCost({ model: 'gemini-3.5-flash-lite', usage }, 83.5);
  assert.equal(result.available, true);
  assert.equal(result.usd, 0.6);
  assert.equal(result.inr, 50.1);
});

test('unknown model, missing usage and cached tokens make cost unavailable', () => {
  assert.equal(estimateGeminiCost({ model: 'unknown', usage }).available, false);
  assert.equal(estimateGeminiCost({ model: 'gemini-3.5-flash-lite', usage: {} }).available, false);
  assert.equal(estimateGeminiCost({ model: 'gemini-3.5-flash-lite', usage: { promptTokenCount: 10, thoughtsTokenCount: 2 } }).available, false);
  assert.equal(estimateGeminiCost({ model: 'gemini-3.5-flash-lite', usage: { ...usage, cachedContentTokenCount: 1 } }).available, false);
});

test('embedding tokens deduplicate by child and are never part of Gemini input or cost', () => {
  const result = summarizeProcessingUsage({ usage: { batches: { one: { model: 'gemini-3.5-flash-lite', usage } } },
    children: [{ id: 'c1', embeddingDetails: { tokenCount: 200 } },
      { id: 'c1', metadata: { embedding: { tokenCount: 200 } } },
      { id: 'c2', metadata: { embedding: { tokenCount: 50 } } }], exchangeRate: 80 });
  assert.equal(result.embeddingTokens, 250);
  assert.equal(result.totals.promptTokenCount, 1_000_000);
  assert.equal(result.usd, 0.6);
});

test('new sections and blocks do not require legacy v4 event shapes', () => {
  let state = emptyStructure();
  state = applyStructureEvent(state, { type: 'section', sectionId: 's1', headingPath: ['Main'], totalBlocks: 2 });
  state = applyStructureEvent(state, { type: 'block', blockId: 'b1', blockType: 'paragraph', page: 2, headingPath: ['Main'], text: 'Step one' });
  state = applyStructureEvent(state, { type: 'chunking_complete', totalSections: 1, totalParents: 2, totalChildren: 3 });
  assert.equal(state.sections.s1.totalBlocks, 2);
  assert.equal(state.blocks.b1.text, 'Step one');
  assert.deepEqual(state.headings, {});
  assert.deepEqual(state.parts, {});
});

