/**
 * View model for the Search Inspector: which chunks each search method found,
 * per retrieval round and per query, and how the reranker reordered them.
 *
 * Built from the same `steps` the timeline renders, so a live stream and a
 * replay of `metadata.steps` after refresh go through one path. Raw events are
 * passed through untouched — cards memoise on their identity, which immer
 * keeps stable while tokens stream into the same message.
 */

export const SOURCES = ['vector', 'keyword', 'identifier', 'phrase'];

export const SOURCE_LABELS = { vector: 'Vector', keyword: 'Keyword', identifier: 'ID', phrase: 'Phrase' };

const RANK_FIELDS = { vector: 'vectorRank', keyword: 'keywordRank', identifier: 'identifierRank', phrase: 'phraseRank' };

const TIMELINE_KINDS = new Set(['status', 'tool_start', 'tool_finish', 'grading_result', 'error']);

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** A rank is 1-based, or null when that search did not find the chunk — never 0. */
export const rankOf = (doc, source) => {
  const rank = finite(doc?.[RANK_FIELDS[source]]);
  return rank != null && rank > 0 ? rank : null;
};

/** Every source that found this chunk, by rank or by `matchedBy`. */
export const sourcesOf = (doc) => {
  const matched = Array.isArray(doc?.matchedBy) ? doc.matchedBy : [];
  return SOURCES.filter((source) => rankOf(doc, source) != null || matched.includes(source));
};

export const formatScore = (value) => (finite(value) != null ? value.toFixed(3) : '—');

/** "↑ from #14", "↓ from #2", "= #1" — null when the retrieval rank is unknown. */
export const rankMovement = (doc) => {
  const before = finite(doc?.retrievalRank);
  const after = finite(doc?.rerankRank);
  if (before == null || after == null) return null;
  if (after < before) return { direction: 'up', label: `↑ from #${before}` };
  if (after > before) return { direction: 'down', label: `↓ from #${before}` };
  return { direction: 'same', label: `= #${before}` };
};

/** Nulls last, then the order the backend sent — it is already best first. */
const byRank = (field) => (documents) => (Array.isArray(documents) ? documents : [])
  .map((doc, index) => ({ doc, index }))
  .sort((a, b) => (finite(a.doc?.[field]) ?? Infinity) - (finite(b.doc?.[field]) ?? Infinity) || a.index - b.index)
  .map(({ doc }) => doc);

export const byRetrievalRank = byRank('retrievalRank');
export const byRerankRank = byRank('rerankRank');

export const FILTERS = [
  { id: 'all', label: 'All', test: () => true },
  { id: 'vector', label: 'Vector only', test: (sources) => sources.length === 1 && sources[0] === 'vector' },
  { id: 'keyword', label: 'Keyword only', test: (sources) => sources.length === 1 && sources[0] === 'keyword' },
  { id: 'identifier', label: 'ID', test: (sources) => sources.includes('identifier') },
  { id: 'phrase', label: 'Phrase', test: (sources) => sources.includes('phrase') },
  { id: 'several', label: 'Found by several', test: (sources) => sources.length >= 2 },
];

export const filterDocuments = (documents, filterId) => {
  const filter = FILTERS.find((item) => item.id === filterId) ?? FILTERS[0];
  return documents.filter((doc) => filter.test(sourcesOf(doc)));
};

/** How many candidates each source found, and how many were found by two or more. */
export const sourceSummary = (documents = []) => {
  const counts = Object.fromEntries(SOURCES.map((source) => [source, 0]));
  let several = 0;
  for (const doc of documents) {
    const sources = sourcesOf(doc);
    sources.forEach((source) => { counts[source] += 1; });
    if (sources.length >= 2) several += 1;
  }
  return { counts, several, total: documents.length };
};

export const pageOf = (doc) => doc?.metadata?.page_number ?? null;

export const headingOf = (doc) => (Array.isArray(doc?.metadata?.heading_path) ? doc.metadata.heading_path.join(' › ') : '');

/** Neighbors are context the expansion pulled in around a hit, not search hits themselves. */
export const isNeighbor = (doc, addedIds) => addedIds.has(doc?.id) ||
  (doc?.retrievalOrigin?.type != null && doc.retrievalOrigin.type !== 'search');

export const finalContext = (event) => {
  const added = new Set(Array.isArray(event?.addedParentIds) ? event.addedParentIds : []);
  const documents = Array.isArray(event?.documents) ? event.documents : [];
  return {
    hits: documents.filter((doc) => !isNeighbor(doc, added)),
    neighbors: documents.filter((doc) => isNeighbor(doc, added)),
  };
};

const attemptKey = (event) => finite(event?.attempt);

/**
 * Groups the stream's search events by attempt, then by query text. Queries
 * run in parallel, so their events interleave; first appearance sets order.
 */
export const buildSearchInspector = (steps = []) => {
  const attempts = new Map();
  const timeline = [];
  let plan = null;

  const attemptFor = (event) => {
    const key = attemptKey(event);
    if (!attempts.has(key)) attempts.set(key, { attempt: key, queries: new Map(), expansions: [] });
    return attempts.get(key);
  };
  const queryFor = (event) => {
    const round = attemptFor(event);
    const query = typeof event.query === 'string' ? event.query : '';
    if (!round.queries.has(query)) round.queries.set(query, { query, candidates: null, rerank: null });
    return round.queries.get(query);
  };

  for (const step of steps) {
    const event = step?.event;
    const kind = event?.type ?? step?.kind;

    if (kind === 'tool_finish' && (event?.tool ?? step.label) === 'Question Splitter') {
      plan = {
        queries: Array.isArray(event?.queries) ? event.queries : [],
        searchTiers: Array.isArray(event?.searchTiers) ? event.searchTiers : [],
        hopPlan: Array.isArray(event?.hopPlan) ? event.hopPlan : [],
      };
    }

    if (!event) {
      if (TIMELINE_KINDS.has(kind)) timeline.push({ id: step.id, kind, label: step.label, detail: step.detail });
      continue;
    }

    if (kind === 'retrieval_candidates') queryFor(event).candidates = event;
    else if (kind === 'rerank_result') queryFor(event).rerank = event;
    else if (kind === 'neighbor_expansion') attemptFor(event).expansions.push(event);
    else if (TIMELINE_KINDS.has(kind)) {
      timeline.push({
        id: step.id ?? event.eventId, kind, timestamp: event.timestamp,
        label: kind === 'status' ? event.message ?? step.label : event.tool ?? step.label ?? kind.replace(/_/g, ' '),
        detail: kind === 'grading_result' && Array.isArray(event.keptParentIds)
          ? `Kept ${event.keptParentIds.length}${Array.isArray(event.decisions) ? ` of ${event.decisions.length}` : ''}`
          : event.query ?? (kind === 'error' ? event.message : step.detail),
      });
    }
  }

  const rounds = [...attempts.values()]
    .sort((a, b) => (a.attempt ?? Infinity) - (b.attempt ?? Infinity))
    .map((round) => ({ ...round, queries: [...round.queries.values()] }));

  return { plan, rounds, timeline, available: rounds.length > 0 };
};
