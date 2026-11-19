/**
 * Line-level diff for a "changed" card on the What changed page.
 *
 * The backend sends whole parts (before / after text) and no line counts, so
 * the lines are compared here. A longest-common-subsequence match keeps the
 * order right and treats a repeated line correctly: a line is context only
 * where it lines up in both texts, removed if it is only in `before`, added if
 * it is only in `after`.
 *
 * Parts are a few dozen lines, so the O(n·m) table is cheap.
 */

export const LINE = { CONTEXT: 'context', ADDED: 'added', REMOVED: 'removed' };

const splitLines = (text) => (typeof text === 'string' ? text.split('\n') : []);

export const diffLines = (beforeText, afterText) => {
  const a = splitLines(beforeText);
  const b = splitLines(afterText);
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = length of the common subsequence of a[i..] and b[j..].
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const before = [];
  const after = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      before.push({ text: a[i], kind: LINE.CONTEXT });
      after.push({ text: b[j], kind: LINE.CONTEXT });
      i += 1;
      j += 1;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      after.push({ text: b[j], kind: LINE.ADDED });
      j += 1;
    } else {
      before.push({ text: a[i], kind: LINE.REMOVED });
      i += 1;
    }
  }

  const removed = before.filter((line) => line.kind === LINE.REMOVED).length;
  const added = after.filter((line) => line.kind === LINE.ADDED).length;
  return { before, after, removed, added };
};

/** Whole text in one kind — an added or removed section. */
export const markAll = (text, kind) => splitLines(text).map((line) => ({ text: line, kind }));

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * "2 lines changed" — a removed line paired with an added one is one changed
 * line; whatever is left over on either side is added or removed.
 */
export const lineSummary = ({ removed, added }) => {
  const changed = Math.min(removed, added);
  const parts = [];
  if (changed) parts.push(`${plural(changed, 'line')} changed`);
  if (added > changed) parts.push(`${plural(added - changed, 'line')} added`);
  if (removed > changed) parts.push(`${plural(removed - changed, 'line')} removed`);
  return parts.length ? parts.join(', ') : 'Only whitespace or order changed';
};

/**
 * Lines to draw when "Show only changed lines" is on: changed lines stay, and
 * every run of hidden context becomes one `{ kind: 'gap', count }` marker.
 */
export const onlyChanged = (lines) => {
  const out = [];
  let hidden = 0;
  lines.forEach((line) => {
    if (line.kind === LINE.CONTEXT) {
      hidden += 1;
      return;
    }
    if (hidden) out.push({ kind: 'gap', count: hidden });
    hidden = 0;
    out.push(line);
  });
  if (hidden) out.push({ kind: 'gap', count: hidden });
  return out;
};

/** "page 1", "pages 1–2", "pages 1, 3–4" from one or more page lists. */
export const pagesText = (...lists) => {
  const pages = [...new Set(lists.flat().filter(Number.isFinite))].sort((x, y) => x - y);
  if (pages.length === 0) return null;
  const ranges = [];
  pages.forEach((page) => {
    const last = ranges[ranges.length - 1];
    if (last && page === last[1] + 1) last[1] = page;
    else ranges.push([page, page]);
  });
  const text = ranges.map(([from, to]) => (from === to ? `${from}` : `${from}–${to}`)).join(', ');
  return `${pages.length === 1 ? 'page' : 'pages'} ${text}`;
};
