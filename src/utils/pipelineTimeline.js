/**
 * Shaping for the About page's Engineering Timeline (`GET /pipeline`).
 *
 * The backend sends phases oldest first, and that order is the truth: ids have
 * gaps, and dates are not strictly increasing either (a phase can be dated
 * after the ones that follow it). Nothing here sorts — "newest first" is the
 * same list reversed.
 */

const string = (value) => (typeof value === 'string' ? value : '');

export const normalizePipeline = (payload) => {
  const phases = (Array.isArray(payload?.phases) ? payload.phases : [])
    .filter((phase) => phase && typeof phase === 'object' && phase.id != null)
    .map((phase) => ({
      id: phase.id,
      title: string(phase.title),
      problem: string(phase.problem),
      solution: string(phase.solution),
      terms: Array.isArray(phase.terms) ? phase.terms.filter((term) => typeof term === 'string' && term) : [],
      date: string(phase.date),
    }));
  const total = Number.isFinite(payload?.total) ? payload.total : phases.length;
  return { phases, total };
};

/** "November 7, 2026" → "November 2026". Parsed as text: `Date` would read it in the viewer's time zone. */
export const monthOf = (date) => {
  const match = /^\s*([A-Za-z]+)\s+\d{1,2},\s*(\d{4})\s*$/.exec(date ?? '');
  return match ? `${match[1]} ${match[2]}` : 'Undated';
};

export const matchesQuery = (phase, query) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [phase.title, phase.problem, phase.solution, ...phase.terms].some((field) => field.toLowerCase().includes(needle));
};

export const filterPhases = (phases, { query = '', term = null } = {}) =>
  phases.filter((phase) => (!term || phase.terms.includes(term)) && matchesQuery(phase, query));

export const orderPhases = (phases, order) => (order === 'newest' ? [...phases].reverse() : phases);

/**
 * Month groups in order of first appearance. A month that recurs later (the
 * out-of-order dates above) joins its existing group rather than getting a
 * second heading; within a group the backend order is kept.
 */
export const groupByMonth = (phases) => {
  const groups = new Map();
  for (const phase of phases) {
    const month = monthOf(phase.date);
    if (!groups.has(month)) groups.set(month, { month, phases: [] });
    groups.get(month).phases.push(phase);
  }
  return [...groups.values()];
};

/** The newest entries — the last ones the backend sent — start expanded. */
export const newestIds = (phases, count = 3) => phases.slice(-count).map((phase) => phase.id);

/** First ~`length` characters, cut at a word boundary. */
export const previewText = (text, length = 140) => {
  if (text.length <= length) return text;
  const cut = text.slice(0, length);
  const space = cut.lastIndexOf(' ');
  return `${(space > length * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
};
