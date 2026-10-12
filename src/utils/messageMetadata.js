/** Keep backend metadata intact; validate its optional fields at the rendering boundary. */
export const metadataOf = (message) => message?.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
  ? message.metadata : {};

export const normalizeCitations = (citations) => !Array.isArray(citations) ? [] : citations.filter((citation) => {
  if (!citation || typeof citation !== 'object' || Array.isArray(citation)) return false;
  if (typeof citation.sourceId !== 'string' || !citation.sourceId.trim()) return false;
  for (const field of ['displayLabel', 'documentId', 'documentTitle', 'chunkId', 'snippet']) {
    if (citation[field] != null && typeof citation[field] !== 'string') return false;
  }
  if (citation.fileUrl != null && typeof citation.fileUrl !== 'string') return false;
  if (citation.pageNumber != null && (!Number.isInteger(citation.pageNumber) || citation.pageNumber < 1)) return false;
  if (citation.sourcePages != null && (!Array.isArray(citation.sourcePages) || !citation.sourcePages.every((page) => Number.isInteger(page) && page > 0))) return false;
  for (const field of ['startOffset', 'endOffset']) {
    if (citation[field] != null && (!Number.isInteger(citation[field]) || citation[field] < 0)) return false;
  }
  return true;
});

export const messageCitations = (message) => normalizeCitations(metadataOf(message).citations ?? message?.citations);

export const messageReasoningChain = (message) => {
  const chain = metadataOf(message).reasoningChain;
  if (!chain || typeof chain !== 'object' || Array.isArray(chain)) return null;
  const steps = Array.isArray(chain.steps) ? chain.steps.filter((step) => step && typeof step === 'object' &&
    !Array.isArray(step) && typeof step.type === 'string' && typeof step.title === 'string').map((step) => ({
    ...step, description: typeof step.description === 'string' ? step.description : '',
    findings: typeof step.findings === 'string' ? step.findings : '',
    step: Number.isInteger(step.step) ? step.step : undefined,
  })) : [];
  const summary = typeof chain.summary === 'string' ? chain.summary : '';
  return summary || steps.length ? { summary, steps } : null;
};

export const persistedEvents = (message) => {
  const events = metadataOf(message).steps;
  return Array.isArray(events) ? events.filter((event) => event && typeof event === 'object' && !Array.isArray(event) &&
    typeof event.type === 'string' && event.type !== 'token') : [];
};

/** Replay server events as settled UI steps; backend records remain intact in metadata. */
export const messageSteps = (message) => Array.isArray(message?.steps) && message.steps.length ? message.steps :
  persistedEvents(message).map((event, index) => ({
    id: `${message?.id ?? 'saved'}-step-${index}`, kind: event.type, event, done: true,
    label: event.type === 'status' ? event.message : ['tool_start', 'tool_finish'].includes(event.type) ? event.tool : event.type.replace(/_/g, ' '),
    query: event.query, detail: event.type === 'tool_finish' ? event.message : undefined,
  }));

export const messageStepCosts = (message) => Array.isArray(message?.stepCosts) ? message.stepCosts :
  persistedEvents(message).filter((event) => event.type === 'step_cost');

export const snapshotTrace = (steps = []) => steps.filter((step) => !['token', 'done'].includes(step.kind)).map((step) =>
  step.event ?? (step.kind === 'status' ? { type: 'status', message: step.label } : { type: step.kind, message: step.detail ?? step.label }));

export const messageUsage = (message) => {
  if (message?.usageSummary) return message.usageSummary;
  const summary = persistedEvents(message).findLast((event) => event.type === 'total_usage_summary');
  if (summary) return summary;
  const metadata = metadataOf(message);
  const totalTokens = Number.isFinite(metadata.totalTokens) ? metadata.totalTokens : undefined;
  const totalCostINR = Number.isFinite(metadata.totalCostINR) ? metadata.totalCostINR : undefined;
  const formattedTotalCost = typeof metadata.formattedTotalCost === 'string' ? metadata.formattedTotalCost : undefined;
  return totalTokens != null || totalCostINR != null || formattedTotalCost != null
    ? { totalTokens, totalCostINR, formattedTotalCost } : null;
};
