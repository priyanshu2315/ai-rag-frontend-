/**
 * Wording and small rules for "Replace with new version" (admin only).
 *
 * A replace keeps the document's id, roles and chats; while the new version is
 * processed the document stays COMPLETED and chat answers from the old one.
 */

export const REPLACE_PHASE = {
  QUEUED: 'queued',
  RUNNING: 'running',
  READING: 'reading',
  CHUNKING: 'chunking',
};

export const REPLACE_PHASE_LABEL = {
  [REPLACE_PHASE.QUEUED]: 'Waiting to start',
  [REPLACE_PHASE.RUNNING]: 'Processing',
  [REPLACE_PHASE.READING]: 'Reading the new version',
  [REPLACE_PHASE.CHUNKING]: 'Reading the new version',
};

export const REPLACE_TERMINAL_EVENTS = new Set(['replace_complete', 'replace_failed']);

export const isReplaceTerminal = (event) => REPLACE_TERMINAL_EVENTS.has(event?.type);

const phaseRank = { queued: 0, running: 1, reading: 2, chunking: 3 };

/** Moves forward only: a late extraction event never pulls the label back. */
export const replacePhaseFromEvent = (event, current = REPLACE_PHASE.QUEUED) => {
  const type = event?.type ?? '';
  let next = current;
  if (type === 'replace_running' || type === 'replace_start') next = REPLACE_PHASE.RUNNING;
  else if (/^(extraction|page|ocr|gemini_extraction|markdown_correction)_/.test(type)) next = REPLACE_PHASE.READING;
  else if (/^(chunking|parent|child|embedding)_/.test(type)) next = REPLACE_PHASE.CHUNKING;
  return (phaseRank[next] ?? 0) > (phaseRank[current] ?? 0) ? next : current;
};

/** Only a PDF can replace a document (the backend answers 400 otherwise). */
export const isPdfFile = (file) =>
  Boolean(file) && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name ?? ''));

/** `v3` next to a filename — nothing for a document that was never replaced. */
export const versionLabel = (doc) => (Number(doc?.version) > 1 ? `v${doc.version}` : null);

const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2 lines added, 1 removed" from the 202's `diff` (sentences and table rows). */
export const diffText = (diff) => {
  if (!diff) return null;
  const parts = [];
  if (diff.added) parts.push(`${count(diff.added, 'line')} added`);
  if (diff.removed) parts.push(`${diff.removed} removed`);
  // `moved` (lines that only changed page) is left out: nothing to re-read.
  return parts.length ? parts.join(', ') : null;
};

/** "Version 2: 2 lines added, 1 removed. Processing…" */
export const queuedText = ({ version, diff }) => {
  const label = version ? `Version ${version}` : 'New version';
  const changes = diffText(diff);
  return changes ? `${label}: ${changes}. Processing…` : `${label} is processing…`;
};

/**
 * "Version 2 is live: 6 parts kept, 3 updated" from `replace_complete`.
 * An edited part arrives as one removed + one added, so `added` is what was
 * updated; removals beyond that are parts that are simply gone.
 */
export const liveText = (event) => {
  const label = event?.version ? `Version ${event.version}` : 'The new version';
  const parents = event?.parents;
  if (!parents) return `${label} is live`;
  const parts = [`${count(parents.kept ?? 0, 'part')} kept`];
  if (parents.added) parts.push(`${parents.added} updated`);
  const gone = (parents.removed ?? 0) - (parents.added ?? 0);
  if (gone > 0) parts.push(`${gone} removed`);
  return `${label} is live: ${parts.join(', ')}`;
};
