export const GEMINI_LIST_PRICES = {
  'gemini-3.5-flash-lite': {
    inputPerMillionUsd: 0.30,
    outputPerMillionUsd: 2.50,
    label: 'Standard paid API list price',
  },
};

const numberOrZero = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export const operationFromType = (type = '') => {
  if (type.startsWith('gemini_extraction_')) return 'extraction';
  if (type.startsWith('markdown_correction_')) return 'correction';
  return null;
};

export const usageBatchKey = (documentId, operation, batch) =>
  JSON.stringify([documentId, operation, batch]);

export const estimateGeminiCost = (batch, exchangeRate = null) => {
  const usage = batch?.usage;
  const price = GEMINI_LIST_PRICES[batch?.model];
  if (!usage || !price || usage.cachedContentTokenCount != null ||
    usage.promptTokenCount == null || usage.candidatesTokenCount == null) {
    return { available: false, reason: usage?.cachedContentTokenCount != null
      ? 'Cached-token pricing is not configured.' : 'Model pricing or required usage fields are unavailable.' };
  }
  const usd = numberOrZero(usage.promptTokenCount) / 1_000_000 * price.inputPerMillionUsd +
    (numberOrZero(usage.candidatesTokenCount) + numberOrZero(usage.thoughtsTokenCount)) /
      1_000_000 * price.outputPerMillionUsd;
  return { available: true, usd, inr: exchangeRate == null ? null : usd * exchangeRate, price };
};

export const summarizeProcessingUsage = ({ usage = {}, children = [], exchangeRate = null }) => {
  const batches = Object.values(usage.batches ?? {}).sort((a, b) => numberOrZero(a.batch) - numberOrZero(b.batch));
  const totals = batches.reduce((sum, item) => ({
    promptTokenCount: sum.promptTokenCount + numberOrZero(item.usage?.promptTokenCount),
    candidatesTokenCount: sum.candidatesTokenCount + numberOrZero(item.usage?.candidatesTokenCount),
    thoughtsTokenCount: sum.thoughtsTokenCount + numberOrZero(item.usage?.thoughtsTokenCount),
    totalTokenCount: sum.totalTokenCount + numberOrZero(item.usage?.totalTokenCount),
  }), { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0, totalTokenCount: 0 });
  const fields = {
    promptTokenCount: batches.some((item) => item.usage?.promptTokenCount != null),
    candidatesTokenCount: batches.some((item) => item.usage?.candidatesTokenCount != null),
    thoughtsTokenCount: batches.some((item) => item.usage?.thoughtsTokenCount != null),
    totalTokenCount: batches.some((item) => item.usage?.totalTokenCount != null),
  };
  const estimates = batches.map((batch) => estimateGeminiCost(batch, exchangeRate));
  const costAvailable = batches.length > 0 && estimates.every((item) => item.available);
  const embeddingById = new Map();
  for (const child of children) {
    if (!child?.id || embeddingById.has(child.id)) continue;
    const details = child.embeddingDetails ?? child.metadata?.embedding;
    if (details?.tokenCount != null) embeddingById.set(child.id, details);
  }
  return {
    batches, totals, fields, costAvailable,
    usd: costAvailable ? estimates.reduce((sum, item) => sum + item.usd, 0) : null,
    inr: costAvailable && exchangeRate != null ? estimates.reduce((sum, item) => sum + item.inr, 0) : null,
    embeddingTokens: [...embeddingById.values()].reduce((sum, item) => sum + numberOrZero(item.tokenCount), 0),
    embeddedChildren: embeddingById.size,
  };
};

