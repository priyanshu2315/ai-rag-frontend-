import { findPassageRange } from './chatSources.js';

const wordValue = (word) => word.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/,/g, '');
const words = (text) => [...text.matchAll(/[\p{L}\p{N}]+(?:[.,]\d+)*/gu)].map((match) => ({
  value: wordValue(match[0]), start: match.index, end: match.index + match[0].length,
}));
const mergeRanges = (ranges) => {
  const merged = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
};

/** Match visible PDF words, not the Markdown delimiters or document-wide source offsets. */
export const findPdfPassageRanges = (pageText, selection = {}) => {
  const exact = findPassageRange(pageText, selection);
  if (exact) return [exact];
  const pageWords = words(pageText);
  const ranges = [];
  for (const candidate of [selection.text, selection.snippet]) {
    if (typeof candidate !== 'string') continue;
    const candidateWords = words(candidate.replace(/(?:\.\.\.|…)\s*$/, ''));
    if (!candidateWords.length) continue;
    // Markdown emphasis, pipes, punctuation and ligatures may differ, but token order can still match.
    const hits = [];
    for (let index = 0; index <= pageWords.length - candidateWords.length; index += 1) {
      if (candidateWords.every((word, offset) => word.value === pageWords[index + offset].value)) hits.push(index);
    }
    if (hits.length === 1) return [{ start: pageWords[hits[0]].start, end: pageWords[hits[0] + candidateWords.length - 1].end }];
    // Repeated identical passages are ambiguous; never highlight a guessed occurrence.
    if (hits.length > 1) continue;
    const vocabulary = new Set(candidateWords.map((word) => word.value));
    // PDF rows often omit the labels that Markdown denormalization inserts before every value.
    let lineStart = 0;
    for (const line of pageText.split('\n')) {
      const row = words(line).map((word) => ({ ...word, start: word.start + lineStart, end: word.end + lineStart }));
      const matched = row.filter((word) => vocabulary.has(word.value));
      const identifiers = row.filter((word) => /^[a-z]+\d+[a-z]*$/i.test(word.value));
      const differentIdentifier = identifiers.some((word) => !vocabulary.has(word.value));
      // Require substantial row overlap and preserve unmatched values as unhighlighted text.
      if (!differentIdentifier && matched.length >= 3 && matched.length / Math.max(row.length, 1) >= 0.65 &&
        matched.some((word) => /\d/.test(word.value) || word.value.length >= 5)) {
        let group = null;
        for (const word of row) {
          if (!vocabulary.has(word.value)) { group = null; continue; }
          if (group) group.end = word.end;
          else { group = { start: word.start, end: word.end }; ranges.push(group); }
        }
      }
      lineStart += line.length + 1;
    }
    // Find unique multi-word anchors even when the page extractor places a whole table on one line.
    for (const line of candidate.split('\n')) {
      const query = words(line);
      for (let length = Math.min(query.length, 24); length >= 3; length -= 1) {
        let found = false;
        for (let offset = 0; offset <= query.length - length; offset += 1) {
          const phrase = query.slice(offset, offset + length);
          if (!phrase.some((word) => /\d/.test(word.value) || word.value.length >= 5)) continue;
          const locations = [];
          for (let index = 0; index <= pageWords.length - length; index += 1) {
            if (phrase.every((word, position) => word.value === pageWords[index + position].value)) locations.push(index);
          }
          if (locations.length === 1) {
            const index = locations[0];
            ranges.push({ start: pageWords[index].start, end: pageWords[index + length - 1].end });
            found = true;
          }
        }
        if (found) break;
      }
    }
    // A denormalized row may put a value on a different PDF line than its depot identifier.
    // Only attach numeric cells to a preceding identifier from the selected passage.
    if (ranges.length > 0) {
      for (let index = 0; index < pageWords.length; index += 1) {
        const word = pageWords[index];
        if (!/^\d+(?:\.\d+)?$/.test(word.value) || !vocabulary.has(word.value)) continue;
        const preceding = pageWords.slice(Math.max(0, index - 32), index).reverse().find((item) => /^[a-z]+\d+[a-z]*$/i.test(item.value));
        if (preceding && vocabulary.has(preceding.value) && ranges.some((range) =>
          range.start <= preceding.start && range.end >= preceding.end)) {
          ranges.push({ start: word.start, end: word.end });
        }
      }
    }
  }
  return mergeRanges(ranges);
};

export const textRunHighlights = (strings, ranges) => {
  let cursor = 0;
  return strings.map((text) => {
    const start = cursor;
    cursor += text.length + 1;
    return mergeRanges(ranges.filter((range) => range.end > start && range.start < start + text.length).map((range) => ({
      start: Math.max(0, range.start - start), end: Math.min(text.length, range.end - start),
    })));
  });
};

export const isCitationPage = (selection, pageNumber) => (selection.sourcePages?.length
  ? selection.sourcePages : [selection.pageNumber ?? 1]).includes(pageNumber);
