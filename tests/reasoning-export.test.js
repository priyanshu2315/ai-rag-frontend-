import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reasoningExport } from '../src/utils/reasoningExport.js';

test('copy exports the full answer, multiline chain, hidden trace events, evidence, citations and costs', () => {
  const chunks = Array.from({ length: 16 }, (_, index) => ({ id: `chunk-${index}`, text: `Full evidence ${index}`, metadata: { chunk_index: index } }));
  const message = { content: '**Complete answer**\nSecond answer line.', metadata: {
    reasoningChain: { summary: 'Full summary', steps: [{ step: 1, type: 'initial_search', title: 'First step', description: 'Search description', findings: '• Page 4: Found 4,120.\n• Trigger for next step: Follow Appendix B.' },
      { step: 2, type: 'synthesis', title: 'Last step', description: 'Final synthesis', findings: 'Final finding' }] },
    citations: [{ sourceId: 'Page 4', fileUrl: 'https://example.com/report.pdf', pageNumber: 4, startOffset: 1205, endOffset: 1850, snippet: 'Cited passage' }],
    steps: [{ type: 'status', message: 'Search started' }, { type: 'retrieved_chunks', chunks }, { type: 'generation_context', documents: chunks },
      { type: 'step_cost', step: 'Grader', totalTokens: 200, formattedINR: '₹0.01' }, { type: 'total_usage_summary', totalTokens: 200, formattedTotalCost: '₹0.01' }],
  } };
  const original = JSON.stringify(message);
  const output = reasoningExport(message);
  for (const value of [message.content, 'Full summary', 'First step', 'Last step', 'Search description', 'Final synthesis', '• Page 4: Found 4,120.\n• Trigger for next step: Follow Appendix B.', 'Final finding', 'Search started', 'Full evidence 15', 'Cited passage', '1205', '1850', '₹0.01']) assert.ok(output.includes(value), value);
  assert.ok(output.indexOf('First step') < output.indexOf('Last step'));
  assert.equal(JSON.stringify(message), original);
});

test('copy uses current live data and supports legacy messages without a chain', () => {
  const message = { content: 'Partial answer', streaming: true, steps: [{ kind: 'status', label: 'Live retrieval' }] };
  assert.match(reasoningExport(message), /Live retrieval/);
  assert.match(reasoningExport(message), /Copied during streaming/);
  message.content = 'Complete answer';
  message.streaming = false;
  assert.match(reasoningExport(message), /Complete answer/);
  assert.doesNotMatch(reasoningExport(message), /Copied during streaming/);
  assert.match(reasoningExport({ metadata: null }), /No answer text received yet/);
});
