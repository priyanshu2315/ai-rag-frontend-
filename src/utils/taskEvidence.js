/**
 * Data for the "Tasks" step of "How this was answered": for each task the
 * planner made, which passages the answer was built from and which exact
 * lines of them the grader quoted. Everything comes from the events already
 * saved with the message; `generation_context` carries the passage text, so
 * nothing is refetched.
 */

const list = (value) => (Array.isArray(value) ? value : []);
const lastOf = (steps, type) => steps.findLast((step) => (step?.event?.type ?? step?.kind) === type)?.event;

const MIN_PART = 3;

/** Lower-cased copy of `text` with whitespace runs collapsed, and where each of its characters came from. */
const normalizeWithMap = (text) => {
  let normalized = '';
  const origin = [];
  let inSpace = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (/\s/.test(char)) {
      if (!inSpace && normalized) { normalized += ' '; origin.push(index); }
      inSpace = true;
    } else {
      inSpace = false;
      const lower = char.toLowerCase();
      normalized += lower.length === 1 ? lower : char;
      origin.push(index);
    }
  }
  return { normalized, origin };
};

const quoteParts = (quote) => String(quote ?? '')
  .split(/\r?\n|\.{3}|…/)
  .map((part) => part.trim())
  .filter((part) => part.length >= MIN_PART);

/**
 * Where a quote sits in a passage, line by line.
 *
 * The backend accepts a quote when most of its lines match in order, and the
 * grader sometimes skips lines or writes "...", so each line is matched on its
 * own: exact first, then ignoring case and spacing. Overlapping or touching
 * ranges merge. Returns the text cut into marked and unmarked segments, how
 * many characters are marked, and how many lines were not found.
 */
export const highlight = (text, quote) => {
  const source = typeof text === 'string' ? text : '';
  const ranges = [];
  let missingParts = 0;
  let normalizedSource;

  for (const part of quoteParts(quote)) {
    let start = source.indexOf(part);
    if (start >= 0) {
      ranges.push([start, start + part.length]);
      continue;
    }
    normalizedSource ??= normalizeWithMap(source);
    const needle = normalizeWithMap(part).normalized;
    start = needle ? normalizedSource.normalized.indexOf(needle) : -1;
    if (start < 0) { missingParts += 1; continue; }
    const { origin } = normalizedSource;
    ranges.push([origin[start], origin[start + needle.length - 1] + 1]);
  }

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] - last[1] <= 1) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }

  const segments = [];
  let cursor = 0;
  let usedChars = 0;
  for (const [start, end] of merged) {
    if (start > cursor) segments.push({ text: source.slice(cursor, start), marked: false });
    segments.push({ text: source.slice(start, end), marked: true });
    usedChars += end - start;
    cursor = end;
  }
  if (cursor < source.length) segments.push({ text: source.slice(cursor), marked: false });
  return { segments, usedChars, missingParts };
};

const STOP_REASONS = {
  complete: 'all tasks answered',
  round_limit: 'stopped at the round limit',
  no_progress: 'stopped: two rounds without progress',
};

export const taskStopReason = (reason) => (reason == null || reason === '' ? null : STOP_REASONS[reason] ?? String(reason));

const passageOf = (document, number) => ({
  number,
  title: document.documentTitle ?? null,
  section: list(document.metadata?.heading_path).at(-1) ?? null,
  page: document.metadata?.page_number ?? null,
  text: typeof document.text === 'string' ? document.text : '',
});

/**
 * The Tasks step, or null when the message has none: saved before the task
 * plan existed, or missing the passages or the per-task results.
 */
export const buildTaskEvidence = (steps = []) => {
  const result = lastOf(steps, 'search_stop') ?? lastOf(steps, 'grading_result');
  const context = lastOf(steps, 'generation_context');
  const progress = list(result?.hopProgress);
  if (!result || !context || progress.length === 0) return null;

  const documents = list(context.documents);
  const byId = new Map();
  documents.forEach((document, index) => {
    if (document?.id != null && !byId.has(document.id)) byId.set(document.id, passageOf(document, index + 1));
  });
  const plan = list(result.hopPlan ?? lastOf(steps, 'grading_result')?.hopPlan);

  const tasks = progress.map((hop, taskIndex) => {
    const entries = list(hop.evidence).map((item, index) => {
      const passage = byId.get(item?.chunkId) ?? null;
      const quote = typeof item?.quote === 'string' ? item.quote : '';
      return { key: `${item?.chunkId ?? 'unknown'}-${index}`, passage, quote, match: passage ? highlight(passage.text, quote) : null };
    });
    return {
      id: hop.hopId ?? `h${taskIndex + 1}`,
      status: hop.status === 'resolved' ? 'resolved' : 'pending',
      task: plan.find((item) => item.id === hop.hopId)?.task ?? null,
      value: typeof hop.value === 'string' ? hop.value : '',
      builtFrom: Object.keys(hop.inputBindings ?? {}),
      passagesUsed: new Set(list(hop.evidence).map((item) => item?.chunkId)).size,
      entries,
    };
  });

  return {
    tasks,
    resolved: tasks.filter((task) => task.status === 'resolved').length,
    stopReason: taskStopReason(result.stopReason),
    rounds: Number.isFinite(result.rounds) ? result.rounds : null,
    passageCount: documents.length,
  };
};
