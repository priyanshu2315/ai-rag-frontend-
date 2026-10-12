import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { findPdfPassageRanges, isCitationPage, textRunHighlights } from '../src/utils/pdfPassage.js';
import { fixturePdf } from './chat-source-fixtures.js';

const highlighted = (text, ranges) => ranges.map((range) => text.slice(range.start, range.end)).join(' | ');

test('Markdown table cells match PDF text without literal pipes or emphasis', () => {
  const text = 'Depot Code Name Cost\nD01 Alderbank Yard 3,880\nD02 Redbrook Yard 5,100';
  const ranges = findPdfPassageRanges(text, { text: '| Depot | Cost |\n| --- | --- |\n| **D01 Alderbank Yard** | **3,880** |', startOffset: 1205, endOffset: 1850 });
  assert.ok(ranges.length);
  assert.match(highlighted(text, ranges), /D01 Alderbank Yard 3,880/);
  assert.doesNotMatch(highlighted(text, ranges), /D02|5,100/);
});

test('denormalized Markdown labels do not prevent highlighting the actual PDF row', () => {
  const text = 'Depot Code and Name\nD08 Tollwick Hub II 4,120\nD09 Other Depot 4,120';
  const ranges = findPdfPassageRanges(text, { text: 'Depot Code and Name: **D08 Tollwick Hub II**\nColumn A — fiscal 2022 operating cost: **4,120**' });
  assert.match(highlighted(text, ranges), /D08 Tollwick Hub II 4,120/);
  assert.doesNotMatch(highlighted(text, ranges), /D09|Other/);
});

test('PDF ligatures, punctuation and wrapped lines match Markdown tokens', () => {
  const text = 'Financial ﬁgures: Alderbank\nYard cost is 3,880.';
  const ranges = findPdfPassageRanges(text, { text: '**Financial figures**: Alderbank Yard cost is **3880**' });
  assert.ok(ranges.length);
  assert.match(highlighted(text, ranges), /3,880/);
});

test('unrelated and ambiguous text never becomes a guessed PDF highlight', () => {
  assert.deepEqual(findPdfPassageRanges('Scanned page has no readable body', { text: '| D08 | 4,120 |' }), []);
  assert.deepEqual(findPdfPassageRanges('Depot D01 Yard\nDepot D01 Yard', { text: '**Depot D01 Yard**' }), []);
  assert.deepEqual(findPdfPassageRanges('', { snippet: 'D08 Tollwick...' }), []);
});

test('multiple passage highlights map to separate portions of the same PDF text run', () => {
  assert.deepEqual(textRunHighlights(['D01 price 3880', 'Next row'], [{ start: 0, end: 3 }, { start: 10, end: 14 }]),
    [[{ start: 0, end: 3 }, { start: 10, end: 14 }], []]);
  assert.equal(isCitationPage({ pageNumber: 3, sourcePages: [3, 4] }, 4), true);
  assert.equal(isCitationPage({ pageNumber: 3, sourcePages: [3, 4] }, 5), false);
});

test('a real PDF page receives on-page ranges from a Markdown-formatted cited passage', async () => {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loading = getDocument({ data: fixturePdf(), isEvalSupported: false,
    standardFontDataUrl: fileURLToPath(new URL('../node_modules/pdfjs-dist/standard_fonts/', import.meta.url)).replace(/\\/g, '/') });
  try {
    const pdf = await loading.promise;
    const content = await (await pdf.getPage(3)).getTextContent();
    const items = content.items.filter((item) => typeof item.str === 'string');
    const strings = items.map((item) => item.str);
    const pageText = items.map((item) => item.str + (item.hasEOL ? '\n' : ' ')).join('');
    const ranges = findPdfPassageRanges(pageText, { text: '| Depot Code and Name | Operating cost |\n| --- | --- |\n| **D01 Alderbank Yard** | **3,880** |' });
    const parts = textRunHighlights(strings, ranges);
    const visible = parts.flatMap((highlights, index) => highlights.map((part) => strings[index].slice(part.start, part.end))).join(' ');
    assert.match(visible, /D01 Alderbank Yard/);
    assert.match(visible, /3,880/);
  } finally { await loading.destroy(); }
});
