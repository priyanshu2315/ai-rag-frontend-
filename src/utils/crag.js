export const ORIGIN_LABELS = {
  search: 'Search Hit',
  table_continuation: 'Table Continuation',
  section_expansion: 'Section Expansion',
  section_sibling: 'Context Sibling',
  section_lead: 'Section Header & Scope',
  reference_following: 'Reference Followed',
  neighbor_expansion: 'Reading Order',
};

export const originLabel = (origin) => origin?.type === 'reference_following' ? `Reference Followed: ${origin.reference ?? 'Unspecified reference'}` : ORIGIN_LABELS[origin?.type] ??
  (origin?.type === 'neighbor' ? 'Reading Order' : origin?.type ?? 'Origin unavailable');

// Only explicit Page citations are interpreted. Ordinary Markdown links remain links.
export const parseCitations = (text = '') => [...text.matchAll(
  /\[([^\[\]\n:]+):\s*(?:([^\[\]\n]+?),\s*)?Page\s+(\d+)(?:\s*[-–]\s*(\d+))?(?:\s*\(([^\]\n]+)\))?\s*\]/gi
)].map((match) => ({
  raw: match[0], index: match.index, sourceId: match[1].trim(),
  documentTitle: match[2]?.trim() ?? null, pageStart: Number(match[3]),
  pageEnd: Number(match[4] ?? match[3]), section: match[5]?.trim() ?? null,
}));

export const citationLabel = (citation) => citation.displayLabel ?? (citation.pageStart != null || citation.pageNumber != null
  ? `Page ${citation.pageStart ?? citation.pageNumber}${citation.pageEnd != null && citation.pageEnd !== citation.pageStart ? `–${citation.pageEnd}` : ''}${citation.section ? ` · ${citation.section}` : ''}`
  : citation.sourceId ?? 'Source');

/** Prefer the final generation sources; rejected earlier candidates are not citations. */
export const sourceDocuments = (steps = []) => {
  const final = [...steps].reverse().find((step) => step.kind === 'generation_context');
  const records = final ? final.event?.documents ?? [] : steps.flatMap((step) => step.event?.documents ?? step.event?.chunks ?? step.event?.addedNeighbors ?? []);
  return [...new Map(records.filter((item) => item?.id).map((item) =>
    [JSON.stringify([item.documentId, item.id]), item])).values()];
};

export const resolveCitation = (citation, documents = []) => {
  const matches = documents.filter((parent) => parent.id === (citation.chunkId ?? citation.sourceId) &&
    (!citation.documentTitle || (parent.metadata?.document_title ?? parent.documentTitle) === citation.documentTitle));
  // Never guess by page number: global results can share the same page and title.
  return matches.length === 1 ? matches[0] : null;
};

export const summarizeTrace = (steps = []) => {
  let intent = null;
  let pageNumber = null;
  const queries = [];
  const rounds = new Map();
  const followUps = [];
  const timeline = [];
  const queryGroups = new Map();
  for (const step of steps) {
    const event = step.event;
    if (event?.intent) intent = event.intent;
    if (event?.pageNumber != null) pageNumber = event.pageNumber;
    if (Array.isArray(event?.queries)) queries.push(...event.queries);
    const query = event?.query ?? step.query;
    if (query && (step.label === 'Hybrid Search' || ['retrieval_candidates', 'rerank_result', 'neighbor_expansion', 'grading_result'].includes(step.kind))) {
      if (!queryGroups.has(query)) queryGroups.set(query, { query, steps: [], attempts: [] });
      const group = queryGroups.get(query);
      group.steps.push(step);
      if (event?.attempt != null && !group.attempts.includes(event.attempt)) group.attempts.push(event.attempt);
    }
    if (((step.kind === 'tool_finish' && step.label === 'Query Rewriter') || ['next_hop', 'rewrite'].includes(step.kind)) && event?.query) {
      followUps.push(event.query);
      timeline.push({ kind: 'follow_up', query: event.query });
    }
    if (event?.attempt != null) {
      if (!rounds.has(event.attempt)) {
        const round = { kind: 'round', attempt: event.attempt, stages: [], query: null, queries: [] };
        rounds.set(event.attempt, round);
        timeline.push(round);
      }
      const round = rounds.get(event.attempt);
      const stage = { retrieval_candidates: 'Search', rerank_result: 'Reranked',
        neighbor_expansion: 'Expanded', grading_result: 'Graded' }[step.kind];
      if (stage && !round.stages.includes(stage)) round.stages.push(stage);
      if (event.query) {
        round.query ??= event.query;
        if (!round.queries.includes(event.query)) round.queries.push(event.query);
      }
    }
  }
  const counts = Object.fromEntries(Object.keys(ORIGIN_LABELS).map((key) => [key, 0]));
  for (const parent of sourceDocuments(steps)) {
    const type = parent.retrievalOrigin?.type;
    if (Object.hasOwn(counts, type)) counts[type] += 1;
    else if (type === 'neighbor') counts.neighbor_expansion += 1;
  }
  const intentName = typeof intent === 'string' ? intent : null;
  const intentBadge = pageNumber != null ? `Page ${pageNumber}` :
    ({ search: 'Search', answer: 'Search', summary: 'Summary', greeting: 'Greeting', page: 'Page' }[intentName?.toLowerCase()] ?? intentName);
  return { intentBadge, queries: [...new Set(queries)], queryGroups: [...queryGroups.values()], rounds: [...rounds.values()], timeline, followUps, counts,
    expansionCount: counts.table_continuation + counts.section_expansion + counts.neighbor_expansion + counts.reference_following + counts.section_sibling + counts.section_lead };
};
