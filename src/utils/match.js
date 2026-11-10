/**
 * Forgiving name search for client-side filters (document names, role names).
 *
 * Names like `FIN-02_Budget_v3.pdf` mix separators, case and zero-padded
 * numbers that nobody types exactly, so a query matches when either:
 * - the name contains it as typed (case-insensitive), or
 * - every word of the query matches some word of the name, where words are
 *   runs of letters or digits (so `fin2`, `fin 2` and `FIN_2` all split the
 *   same way), letters match anywhere inside a word, and numbers compare by
 *   value, so `2` matches `02` but not `20` or `2026`.
 */

const WORD = /\p{L}+|\p{N}+/gu;
const NUMBER = /^\p{N}+$/u;

const words = (text) => text.toLowerCase().match(WORD) ?? [];
const withoutLeadingZeros = (digits) => digits.replace(/^0+(?=\d)/, '');

const wordMatches = (queryWord, nameWord) => {
  if (NUMBER.test(queryWord)) {
    return NUMBER.test(nameWord) && withoutLeadingZeros(nameWord) === withoutLeadingZeros(queryWord);
  }
  return nameWord.includes(queryWord);
};

/** True when `text` matches `query`; an empty query matches everything. */
export const matchesQuery = (text, query) => {
  const needle = (query ?? '').trim().toLowerCase();
  if (!needle) return true;

  const haystack = (text ?? '').toLowerCase();
  if (haystack.includes(needle)) return true;

  const queryWords = words(needle);
  if (queryWords.length === 0) return false;
  const nameWords = words(haystack);
  return queryWords.every((queryWord) => nameWords.some((nameWord) => wordMatches(queryWord, nameWord)));
};

/** `items` whose `getText(item)` matches `query`, in their original order. */
export const filterByQuery = (items, query, getText) =>
  (query ?? '').trim() ? items.filter((item) => matchesQuery(getText(item), query)) : items;
