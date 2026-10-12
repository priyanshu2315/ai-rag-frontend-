import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readableTraceText, traceChunkLabel, traceChunkLabels } from '../src/utils/traceChunks.js';

const id = 'c5a1f4b2-0000-4000-8000-000000000001';

test('chunk indexes survive later grading records without metadata and preserve zero', () => {
  const labels = traceChunkLabels([
    { event: { documents: [{ id, metadata: { chunk_index: 0, document_title: 'Handbook.pdf' } }] } },
    { event: { decisions: [{ parentId: id, relevant: true }] } },
  ]);
  assert.equal(traceChunkLabel(id, labels), 'Chunk 0 · Handbook.pdf');
  assert.equal(readableTraceText(`Grading ${id}: kept`, labels), 'Grading Chunk 0 · Handbook.pdf: kept');
});

test('legacy retrieval records and neighbor records resolve their stored indexes', () => {
  const labels = traceChunkLabels([{ event: { data: {
    retrievedParents: [{ id, metadata: { chunk_index: 7 } }],
    addedNeighbors: [{ id: 'neighbor-1', metadata: { chunk_index: 8 } }],
  } } }]);
  assert.equal(traceChunkLabel(id, labels), 'Chunk 7');
  assert.equal(traceChunkLabel('neighbor-1', labels), 'Chunk 8');
});

test('missing indexes do not invent a chunk number or expose a UUID in step text', () => {
  assert.equal(readableTraceText(`Grading ${id}`, new Map()), 'Grading Chunk (index unavailable)');
  assert.equal(traceChunkLabel('unknown', new Map()), 'Chunk (index unavailable)');
  assert.equal(readableTraceText('Processed 4 chunks', new Map()), 'Processed 4 chunks');
});
