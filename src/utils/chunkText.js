import { stripHtml } from './format.js';

/**
 * Chunk text as a reader would want it, for the chunk viewer's "Clean" view.
 *
 * The raw text is the parser's markdown: inline HTML, and hard line breaks
 * wherever the PDF wrapped a line. Clean keeps the structure the text means —
 * tables, lists, headings, one fact per line — and drops the structure the page
 * width imposed: a line that runs on into a lowercase continuation is joined
 * back into its sentence ("infor-\nmation" → "infor-mation", never guessed into
 * one word). Every other single break stays a break, so key/value lines do not
 * collapse into one run-on paragraph.
 *
 * The result is markdown for the app's `Markdown` renderer, which escapes HTML.
 */

const TABLE_LINE = /^\s*\|/;
const FENCE = /^\s*(```|~~~)/;
const BLOCK_START = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>)/;
const CONTINUATION = /^[a-z(]/;

const reflowBlock = (block) => {
  const lines = block.split('\n');
  // A table or a code block is laid out on purpose; spacing inside it is meaning.
  if (lines.some((line) => TABLE_LINE.test(line) || FENCE.test(line))) return block;

  const out = [];
  for (const raw of lines) {
    const line = raw.replace(/[ \t]+/g, ' ').trim();
    if (!line) continue;
    const previous = out[out.length - 1];
    if (previous != null && CONTINUATION.test(line) && !BLOCK_START.test(line) && !/^#{1,6}\s/.test(previous)) {
      out[out.length - 1] = /\w-$/.test(previous) ? `${previous}${line}` : `${previous} ${line}`;
    } else {
      out.push(line);
    }
  }
  // Two trailing spaces: a markdown hard break, so a kept break renders as one.
  return out.map((line, index) => (index < out.length - 1 && !BLOCK_START.test(out[index + 1]) ? `${line}  ` : line)).join('\n');
};

export const readableChunkText = (text) => {
  const value = stripHtml(typeof text === 'string' ? text : '');
  if (!value) return '';
  // Split on blank lines, but keep fenced code whole even if it holds one.
  const blocks = [];
  let fence = null;
  for (const part of value.split(/\n{2,}/)) {
    if (fence != null) {
      fence = `${fence}\n\n${part}`;
      if ((part.match(/^\s*(```|~~~)/gm) ?? []).length % 2 === 1) { blocks.push(fence); fence = null; }
    } else if ((part.match(/^\s*(```|~~~)/gm) ?? []).length % 2 === 1) {
      fence = part;
    } else {
      blocks.push(reflowBlock(part));
    }
  }
  if (fence != null) blocks.push(fence);
  return blocks.filter(Boolean).join('\n\n');
};

export const textStats = (text) => {
  const value = typeof text === 'string' ? text : '';
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return { characters: value.length, words };
};
