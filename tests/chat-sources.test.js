import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildCitationIndex, chunkForCitation, evidenceForAnswer, findPassageRange, pdfPageUrl, previewSource, safeFileUrl, streamCitationFor, textItemRanges } from '../src/utils/chatSources.js';
import { parseCitations } from '../src/utils/crag.js';
import { citations, fileUrl, fixturePdf, retrieved, v2Chunks, v2Citations } from './chat-source-fixtures.js';

test('flat citation payload opens the correct file, page, complete text and original offsets', () => {
  const preview = previewSource(citations.citations[0], retrieved.chunks);
  assert.equal(preview.file.fileUrl, fileUrl);
  assert.equal(preview.file.filename, 'Handbook.pdf');
  assert.equal(preview.selection.pageNumber, 3);
  assert.equal(preview.selection.startOffset, 1205);
  assert.equal(preview.selection.endOffset, 1850);
  assert.equal(preview.selection.text, retrieved.chunks[0].text);
  assert.equal(pdfPageUrl(fileUrl, 3), `${fileUrl}#page=3`);
});

test('page labels bind by file URL and offsets across global documents, never by page alone', () => {
  const other = { ...retrieved.chunks[0], id: 'other', fileUrl: 'https://example.com/other.pdf', text: 'Wrong document' };
  assert.equal(chunkForCitation(citations.citations[0], [other, ...retrieved.chunks]), retrieved.chunks[0]);
  assert.equal(chunkForCitation({ sourceId: 'Page 3', pageNumber: 3 }, retrieved.chunks), null);
  assert.equal(chunkForCitation({ ...citations.citations[0], startOffset: 100 }, retrieved.chunks), null);
  assert.equal(previewSource(citations.citations[0], []).selection.text, citations.citations[0].snippet);
  assert.equal(streamCitationFor({ raw: '[Page 3]' }, [citations.citations[0], { ...citations.citations[0], fileUrl: other.fileUrl }]), null);
  assert.equal(streamCitationFor({ raw: `[${citations.citations[0].displayLabel}]` }, citations.citations), citations.citations[0]);
  assert.equal(streamCitationFor({ sourceId: 'wrong-parent', pageStart: 3 }, citations.citations), null);
});

test('unsafe URLs and invalid page values do not become preview destinations', () => {
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'file:///secret', 'not a URL']) assert.equal(safeFileUrl(unsafe), null);
  assert.equal(pdfPageUrl(`${fileUrl}?token=abc#old`, 3), `${fileUrl}?token=abc#page=3`);
  assert.equal(pdfPageUrl(fileUrl, -1), fileUrl);
  assert.equal(previewSource({ ...citations.citations[0], fileUrl: 'javascript:x' }).file.fileUrl, null);
});

test('passage matching preserves PDF text positions across whitespace, Unicode and text-run boundaries', () => {
  const items = [{ str: 'Cost ₹500' }, { str: 'Depot D01' }];
  const pageText = items.map((item) => item.str).join(' ');
  const range = findPassageRange(pageText, { text: '₹500\nDepot', startOffset: 1205, endOffset: 1850 });
  assert.equal(pageText.slice(range.start, range.end), '₹500 Depot');
  assert.deepEqual(textItemRanges(items, range), [{ start: 5, end: 9 }, { start: 0, end: 5 }]);
  assert.equal(findPassageRange('Unrelated PDF text', { text: 'Depot D01', startOffset: 0, endOffset: 8 }), null);
  assert.equal(findPassageRange('Depot D01 ... Depot D01', { text: 'Depot D01' }), null);
  assert.deepEqual(findPassageRange('Depot D01 ... Depot D01', { text: 'Depot D01', startOffset: 14, endOffset: 23 }), { start: 14, end: 23 });
  assert.deepEqual(findPassageRange('Depot D01 cost', { snippet: 'Depot D01...' }), { start: 0, end: 9 });
});

test('PDF.js retrieves page three of a real PDF fixture and matches the supplied passage', async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({ data: fixturePdf(), isEvalSupported: false,
    standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replace(/\\/g, '/') });
  try {
    const pdf = await loading.promise;
    assert.equal(pdf.numPages, 3);
    const page = await pdf.getPage(3);
    const content = await page.getTextContent();
    const items = content.items.filter((item) => typeof item.str === 'string');
    const text = items.map((item) => item.str).join(' ');
    const range = findPassageRange(text, previewSource(citations.citations[0], retrieved.chunks).selection);
    assert.ok(range);
    assert.match(text.slice(range.start, range.end), /Fiscal 2022 Cost: 3,880/);
    assert.ok(textItemRanges(items, range).some(Boolean));
  } finally { await loading.destroy(); }
});

test('v2 citations are indexed by source and chunk IDs and preserve spans and page-specific URLs', () => {
  const index = buildCitationIndex(v2Citations);
  assert.deepEqual(index.bySourceId['Page 3-4'], [v2Citations[0]]);
  assert.deepEqual(index.byChunkId['round1-parent'], [v2Citations[0]]);
  const parsed = parseCitations('[Source ID: Page 3-4]')[0];
  const resolved = streamCitationFor(parsed, v2Citations, index);
  assert.equal(resolved, v2Citations[0]);
  assert.equal(streamCitationFor({ sourceId: 'round1-parent' }, v2Citations, index), v2Citations[0]);
  const preview = previewSource(resolved, v2Chunks);
  assert.deepEqual(preview.selection.sourcePages, [3, 4]);
  assert.deepEqual(preview.selection.headingPath, ['5. Financial record']);
  assert.equal(pdfPageUrl(preview.file.fileUrl, preview.selection.pageNumber), `${fileUrl}#page=3`);
  assert.equal(preview.selection.startOffset, 124);
  assert.equal(preview.selection.endOffset, 890);
  const other = { ...v2Citations[0], documentId: 'other-doc', documentTitle: 'Other document', chunkId: 'other-parent' };
  assert.equal(streamCitationFor(parsed, [v2Citations[0], other]), null);
  assert.equal(chunkForCitation(other, v2Chunks), null);
});

test('final context removes rejected candidates while retaining ordered approved evidence from every round', () => {
  const rejected = { ...v2Chunks[0], id: 'rejected', text: 'Rejected passage' };
  const message = { retrievedChunks: [rejected, ...v2Chunks], citations: v2Citations,
    steps: [{ kind: 'generation_context', event: { documents: v2Chunks.map((chunk) => ({ id: chunk.id, documentId: chunk.documentId, text: chunk.text })) } }] };
  const evidence = evidenceForAnswer(message);
  assert.deepEqual(evidence.map((chunk) => chunk.id), ['round1-parent', 'round2-parent']);
  assert.equal(evidence[0].fileUrl, fileUrl);
  assert.equal(evidence[0].headingPath[0], '5. Financial record');
  assert.equal(evidenceForAnswer({ ...message, steps: [{ kind: 'generation_context', event: { documents: [] } }] }).length, 0);
});
