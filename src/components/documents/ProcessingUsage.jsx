import { useMemo } from 'react';
import { USD_INR_RATE, USD_INR_RATE_DATE, USD_INR_RATE_SOURCE } from '../../constants/env';
import { summarizeProcessingUsage, estimateGeminiCost } from '../../utils/processingUsage';
import { JsonDetails } from '../chunks/ChunkInspection';

const Count = ({ label, value }) => <span><strong className="text-ink-2">{label}:</strong> {value ?? 'Unavailable'}</span>;
const token = (value) => value == null ? 'Unavailable' : Number(value).toLocaleString();
const money = (value, currency) => value == null ? 'Unavailable' : new Intl.NumberFormat('en-IN', {
  style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: value < 0.01 ? 8 : 4,
}).format(value);

const ProcessingUsage = ({ filename, structure, persistedParents = [], persistedChildren = [], refreshed = false, compact = false }) => {
  const summary = useMemo(() => summarizeProcessingUsage({ usage: structure?.usage,
    children: [...persistedChildren, ...Object.values(structure?.children ?? {})],
    exchangeRate: USD_INR_RATE }), [structure?.usage, structure?.children, persistedChildren]);
  const batches = summary.batches;
  const hasGeminiUsage = batches.length > 0;
  const firstMetadata = persistedParents.find((parent) => parent.metadata)?.metadata ?? {};
  const identity = structure?.identity ?? firstMetadata.document_identity;
  const title = identity?.title ?? firstMetadata.document_title ?? filename;
  const provider = structure?.provider ?? firstMetadata.extraction?.provider;
  const sourceText = firstMetadata.source_text;
  const operation = structure?.usage?.operation ?? (sourceText === 'ai_corrected_markdown' ? 'correction'
    : sourceText === 'ai_extracted_markdown' ? 'extraction' : null);
  const sourcePages = new Set(persistedParents.flatMap((parent) => parent.metadata?.source_pages ??
    (parent.metadata?.page_number == null ? [] : [parent.metadata.page_number])));
  const savedChildren = persistedParents.every((parent) => parent.totalChildren != null)
    ? persistedParents.reduce((sum, parent) => sum + parent.totalChildren, 0) : null;

  return <section className={`${compact ? 'mb-4' : 'mt-5'} rounded-(--radius) border border-border bg-surface p-4 text-[12px] text-muted`}>
    <h3 className="font-display text-[14px] font-semibold text-ink">Processing usage</h3>
    <p className="mt-1 break-words">{title ?? 'Document'}{filename && title !== filename ? ` · ${filename}` : ''}</p>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      <Count label="Provider" value={provider} />
      <Count label="Operation" value={operation} />
      <Count label="Model" value={structure?.usage?.model ?? firstMetadata.extraction?.model} />
      <Count label="Chunker" value={structure?.chunkerVersion ?? firstMetadata.chunker_version} />
      <Count label="Sources" value={structure?.totalSources ?? (firstMetadata.source?.id ? 'At least 1' : null)} />
      <Count label="Pages" value={structure?.totalPages ?? (sourcePages.size || null)} />
      <Count label="Saved parents" value={structure?.savedCounts?.parents ?? (persistedParents.length || null)} />
      <Count label="Saved children" value={structure?.savedCounts?.children ?? savedChildren} />
    </div>

    {hasGeminiUsage ? <>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Count label="Gemini input tokens" value={summary.fields.promptTokenCount ? token(summary.totals.promptTokenCount) : null} />
        <Count label="Output tokens" value={summary.fields.candidatesTokenCount ? token(summary.totals.candidatesTokenCount) : null} />
        {summary.fields.thoughtsTokenCount && <Count label="Thinking tokens" value={token(summary.totals.thoughtsTokenCount)} />}
        {summary.fields.totalTokenCount && <Count label="Reported total tokens" value={token(summary.totals.totalTokenCount)} />}
      </div>
      <p className="mt-2">{refreshed ? 'Captured in this browser; observed batches only.' :
        `Observed ${batches.length}${structure?.usage?.totalBatches != null ? ` of ${structure.usage.totalBatches}` : ''} batches only.`}</p>
      <p className="mt-2"><strong className="text-ink-2">Estimated Gemini API list-price cost:</strong>{' '}
        {summary.costAvailable ? `${money(summary.usd, 'USD')} · ${USD_INR_RATE == null ? 'INR unavailable' : money(summary.inr, 'INR')}` : 'Cost unavailable'}</p>
      <p>USD→INR rate: {USD_INR_RATE ?? 'Unavailable'} · Source: {USD_INR_RATE_SOURCE} · Date: {USD_INR_RATE_DATE}</p>
      <details className="mt-3"><summary className="cursor-pointer font-medium text-ink-2">Observed Gemini batches · {batches.length}</summary>
        <div className="mt-2 space-y-3">{batches.map((batch) => {
          const estimate = estimateGeminiCost(batch, USD_INR_RATE);
          return <div key={`${batch.operation}:${batch.batch}`} className="rounded-(--radius-sm) bg-surface-2 p-3">
            <p>Batch {batch.batch ?? 'Unavailable'} · {batch.operation} · {batch.model ?? 'Model unavailable'}</p>
            <p>Input {token(batch.usage?.promptTokenCount)} · Output {token(batch.usage?.candidatesTokenCount)} · Thinking {token(batch.usage?.thoughtsTokenCount)} · Reported total {token(batch.usage?.totalTokenCount)}</p>
            <p>{estimate.available ? `Estimated list price ${money(estimate.usd, 'USD')}${estimate.inr == null ? '' : ` · ${money(estimate.inr, 'INR')}`}` : `Cost unavailable: ${estimate.reason}`}</p>
            <JsonDetails title="Raw usage and response" value={batch.raw} />
          </div>;
        })}</div>
      </details>
    </> : <p className="mt-3">{refreshed
      ? 'Gemini usage unavailable after refresh because the backend does not persist batch usage in a document usage endpoint.'
      : provider && provider !== 'gemini' && operation !== 'correction'
        ? 'No Gemini extraction call observed.' : 'No Gemini usage response observed yet.'}</p>}

    <p className="mt-3"><strong className="text-ink-2">Local embedding input:</strong>{' '}
      {summary.embeddedChildren ? `${token(summary.embeddingTokens)} tokens across ${summary.embeddedChildren} observed children` : refreshed ? 'Unavailable until saved children are opened' : 'No successful child embedding observed yet'}</p>
    <p>Local embedding: no per-token API charge; compute cost not measured.</p>
    <p className="mt-2">Coverage: Gemini estimate excludes LlamaParse page/credit charges, summary-model usage, local compute, taxes, discounts, credits, invoice adjustments, and live events missed before connection or during disconnect. Parent token budgets are chunk measurements and are not billed usage.</p>
  </section>;
};

export default ProcessingUsage;
