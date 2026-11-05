import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ScanSearch, X } from 'lucide-react';
import cn from '../../utils/cn';
import { originLabel } from '../../utils/crag';
import { traceChunkLabel, traceChunkLabels } from '../../utils/traceChunks';
import {
  FILTERS, SOURCES, SOURCE_LABELS, buildSearchInspector, byRerankRank, byRetrievalRank, filterDocuments,
  finalContext, formatScore, headingOf, pageOf, rankMovement, rankOf, sourceSummary, sourcesOf,
} from '../../utils/searchInspector';

const PREVIEW_LENGTH = 200;

// Token pairs, so every chip keeps its contrast when the theme flips.
const TONES = {
  vector: 'border-blue/30 bg-blue-lt text-blue',
  keyword: 'border-green/30 bg-green-bg text-green',
  identifier: 'border-orange/30 bg-orange-bg text-orange',
  phrase: 'border-purple/30 bg-purple-bg text-purple',
  neighbor: 'border-border-2 bg-surface-2 text-muted',
};

const Chip = ({ tone, children, title }) => (
  <span title={title} className={cn('inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium break-all', TONES[tone])}>
    {children}
  </span>
);

const SourceBadges = ({ doc }) => (
  <span className="flex flex-wrap gap-1">
    {sourcesOf(doc).map((source) => {
      const rank = rankOf(doc, source);
      return <Chip key={source} tone={source}>{SOURCE_LABELS[source]}{rank != null && ` #${rank}`}</Chip>;
    })}
  </span>
);

const MOVEMENT_TONES = { up: 'text-green', down: 'text-red', same: 'text-muted' };

/**
 * One chunk. The summary is the scannable line; the full text and searchText
 * only mount once it is opened — a round can carry dozens of candidates.
 */
const DocRow = ({ doc, rank, score, movement, chunkLabels, neighbor }) => {
  const [open, setOpen] = useState(false);
  const text = typeof doc.text === 'string' ? doc.text : '';
  const page = pageOf(doc);
  const heading = headingOf(doc);
  return (
    <li>
      <details onToggle={(event) => setOpen(event.currentTarget.open)}
        className={cn('rounded-(--radius-sm) border p-2', neighbor ? 'border-dashed border-border-2 bg-surface-2' : 'border-border bg-surface')}>
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
            {rank != null && <span className="mono font-semibold text-ink">#{rank}</span>}
            {score !== undefined && <span className="mono text-ink-2" title="Score">{formatScore(score)}</span>}
            {movement && <span className={cn('mono font-medium', MOVEMENT_TONES[movement.direction])}>{movement.label}</span>}
            {neighbor ? <Chip tone="neighbor">{originLabel(doc.retrievalOrigin)}</Chip> : <SourceBadges doc={doc} />}
            <span className="text-muted">{traceChunkLabel(doc.id, chunkLabels, doc)}</span>
            {page != null && <span className="text-muted">· page {page}</span>}
          </div>
          {heading && <p className="mt-1 break-words text-[11px] text-muted">{heading}</p>}
          <p className={cn('mt-1 break-words text-[12px] leading-snug', neighbor ? 'text-muted' : 'text-ink-2')}>
            {text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text || 'No text supplied.'}
          </p>
        </summary>
        {open && (
          <div className="mt-2 space-y-2 border-t border-border pt-2 text-[12px]">
            <div>
              <p className="text-[11px] font-semibold text-ink-2">Full text</p>
              <pre className="mono mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-(--radius-sm) bg-surface-2 p-2 text-[11px] text-ink-2">{text || '—'}</pre>
            </div>
            {typeof doc.searchText === 'string' && doc.searchText && doc.searchText !== text && (
              <div>
                <p className="text-[11px] font-semibold text-ink-2">Search text</p>
                <pre className="mono mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-(--radius-sm) bg-surface-2 p-2 text-[11px] text-ink-2">{doc.searchText}</pre>
              </div>
            )}
            {doc.id && <p className="mono break-all text-[10px] text-muted-2">{doc.id}</p>}
          </div>
        )}
      </details>
    </li>
  );
};

const SearchInputChips = ({ inputs, query }) => {
  const ids = Array.isArray(inputs?.idPatterns) ? inputs.idPatterns.filter(Boolean) : [];
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      <Chip tone="vector" title={inputs?.text ?? query}>Vector</Chip>
      {ids.map((id) => <Chip key={id} tone="identifier" title="Identifier pattern">ID: {id}</Chip>)}
      {inputs?.phraseQuery && <Chip tone="phrase" title="Phrase query">Phrase: {inputs.phraseQuery}</Chip>}
      {inputs?.wordQuery && <Chip tone="keyword" title="Keyword query">Keyword: {inputs.wordQuery}</Chip>}
    </div>
  );
};

const SummaryRow = ({ documents }) => {
  const { counts, several, total } = sourceSummary(documents);
  return (
    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
      <span><strong className="text-ink-2">{total}</strong> candidates</span>
      {SOURCES.map((source) => <span key={source}>{SOURCE_LABELS[source]} <strong className="text-ink-2">{counts[source]}</strong></span>)}
      <span>Found by 2+ <strong className="text-ink-2">{several}</strong></span>
    </p>
  );
};

/**
 * One query's search. Memoised on the raw events, which keep their identity
 * while tokens stream into the message — so only a card whose own event just
 * arrived re-renders.
 */
const QueryCard = memo(({ query, candidates, rerank, streaming, chunkLabels }) => {
  const [tab, setTab] = useState('before');
  const [filter, setFilter] = useState('all');
  const tabsId = useId();
  const before = useMemo(() => byRetrievalRank(candidates?.documents), [candidates]);
  const shown = useMemo(() => filterDocuments(before, filter), [before, filter]);
  const after = useMemo(() => byRerankRank(rerank?.documents), [rerank]);

  const tabs = [['before', `Before rerank · ${before.length}`], ['after', `After rerank · ${rerank ? after.length : '…'}`]];

  return (
    <article className="rounded-(--radius) border border-border bg-surface p-3 shadow-(--sh-sm)">
      <h4 className="break-words text-[13px] font-semibold text-ink">{query || 'Query text unavailable'}</h4>
      <SearchInputChips inputs={candidates?.searchInputs} query={query} />
      <SummaryRow documents={before} />

      <div role="tablist" aria-label="Rerank stage" className="mt-3 flex gap-1 border-b border-border">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" id={`${tabsId}-${id}`} aria-selected={tab === id} aria-controls={`${tabsId}-${id}-panel`}
            onClick={() => setTab(id)}
            className={cn('-mb-px border-b-2 px-2.5 py-1.5 text-[12px] font-medium transition-colors',
              tab === id ? 'border-blue text-blue' : 'border-transparent text-muted hover:text-ink')}>
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${tabsId}-${tab}-panel`} aria-labelledby={`${tabsId}-${tab}`} className="mt-2">
        {tab === 'before' && (
          <>
            <div role="group" aria-label="Filter by search source" className="mb-2 flex flex-wrap gap-1">
              {FILTERS.map((item) => (
                <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                    filter === item.id ? 'border-blue bg-blue-lt text-blue' : 'border-border text-muted hover:bg-surface-2 hover:text-ink')}>
                  {item.label}
                </button>
              ))}
            </div>
            {!candidates && <p className="text-[12px] text-muted">{streaming ? 'Searching…' : 'No candidates were recorded for this query.'}</p>}
            {candidates && shown.length === 0 && <p className="text-[12px] text-muted">No candidates match this filter.</p>}
            <ol className="space-y-1.5">
              {shown.map((doc, index) => (
                <DocRow key={doc.id ?? index} doc={doc} rank={doc.retrievalRank} score={doc.retrievalScore} chunkLabels={chunkLabels} />
              ))}
            </ol>
          </>
        )}

        {tab === 'after' && (
          <>
            {rerank?.rerankApplied === false && (
              <p role="alert" className="mb-2 flex items-start gap-2 rounded-(--radius-sm) border border-amber/30 bg-amber-bg p-2 text-[12px] text-amber">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                The reranker failed for this query. These are the top search hits in retrieval order, without rerank scores.
              </p>
            )}
            {!rerank && <p className="text-[12px] text-muted">{streaming ? 'Waiting for the reranker…' : 'No rerank result was recorded for this query.'}</p>}
            <ol className="space-y-1.5">
              {after.map((doc, index) => (
                <DocRow key={doc.id ?? index} doc={doc} rank={doc.rerankRank ?? doc.retrievalRank} score={doc.rerankScore}
                  movement={rerank?.rerankApplied === false ? null : rankMovement(doc)} chunkLabels={chunkLabels} />
              ))}
            </ol>
          </>
        )}
      </div>
    </article>
  );
});

QueryCard.displayName = 'QueryCard';

const FinalContext = ({ event, chunkLabels }) => {
  const { hits, neighbors } = finalContext(event);
  return (
    <section className="rounded-(--radius) border border-border bg-surface-2 p-3">
      <h4 className="text-[13px] font-semibold text-ink">Final context</h4>
      <p className="mt-0.5 text-[11px] text-muted">{hits.length} search hits · {neighbors.length} added neighbors (context, not search hits)</p>
      <ol className="mt-2 space-y-1.5">
        {hits.map((doc, index) => <DocRow key={doc.id ?? index} doc={doc} rank={doc.rerankRank ?? doc.retrievalRank} chunkLabels={chunkLabels} />)}
        {neighbors.map((doc, index) => <DocRow key={doc.id ?? `n-${index}`} doc={doc} neighbor chunkLabels={chunkLabels} />)}
      </ol>
    </section>
  );
};

const SearchPlan = ({ plan }) => (
  <section className="rounded-(--radius) border border-border p-3">
    <h3 className="text-[13px] font-semibold text-ink">Search plan</h3>
    {plan.searchTiers.length > 0 ? (
      <ol className="mt-2 space-y-2">
        {plan.searchTiers.map((tier, index) => (
          <li key={`${tier.text}-${index}`} className="text-[12px]">
            <p className="break-words text-ink-2">{tier.text}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(tier.identifiers ?? []).map((value) => <Chip key={`i-${value}`} tone="identifier">ID: {value}</Chip>)}
              {(tier.keywords ?? []).map((value) => <Chip key={`k-${value}`} tone="keyword">{value}</Chip>)}
              {(tier.entities ?? []).map((value) => <Chip key={`e-${value}`} tone="neighbor">{value}</Chip>)}
            </div>
          </li>
        ))}
      </ol>
    ) : (
      <ol className="mt-2 ml-4 list-decimal text-[12px] text-ink-2">{plan.queries.map((query) => <li key={query}>{query}</li>)}</ol>
    )}
    {plan.hopPlan.length > 0 && (
      <div className="mt-3">
        <p className="text-[11px] font-semibold text-ink-2">Hop plan</p>
        <ol className="mt-1 space-y-0.5 text-[12px] text-muted">
          {plan.hopPlan.map((hop) => (
            <li key={hop.id}><span className="mono text-ink-2">{hop.id}</span> {hop.task}
              {hop.dependsOn?.length > 0 && <span className="text-muted-2"> · after {hop.dependsOn.join(', ')}</span>}</li>
          ))}
        </ol>
      </div>
    )}
  </section>
);

const Timeline = ({ items, streaming }) => {
  if (!items.length) return null;
  const latest = items[items.length - 1];
  return (
    <details className="rounded-(--radius) border border-border p-3 text-[12px]">
      <summary className="cursor-pointer text-muted">
        <span className="font-semibold text-ink-2">Timeline · {items.length}</span>
        {streaming && <span> · {latest.label}</span>}
      </summary>
      <ol className="mt-2 space-y-1">
        {items.map((item, index) => (
          <li key={item.id ?? index} className="grid grid-cols-[6.5rem_1fr] gap-2">
            <span className="mono text-[10px] text-muted-2">{item.kind}</span>
            <span className={cn('break-words', item.kind === 'error' ? 'text-red' : 'text-ink-2')}>
              {item.label}{item.detail && <span className="text-muted"> · {item.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
};

/**
 * Every token bumps the message's last step, so `steps` is a new array per
 * fragment. The search events themselves keep their identity under immer —
 * holding on to the same list until one of them changes keeps the cards'
 * memo from being defeated mid-stream.
 */
const useSearchSteps = (steps) => {
  const ref = useRef([]);
  const next = steps.filter((step) => step.kind !== 'token');
  if (next.length !== ref.current.length || next.some((step, index) => step !== ref.current[index])) ref.current = next;
  return ref.current;
};

/** The inspector body — separate from the dialog so it renders without a DOM. */
export const SearchInspectorContent = ({ steps = [], streaming }) => {
  const searchSteps = useSearchSteps(steps);
  const model = useMemo(() => buildSearchInspector(searchSteps), [searchSteps]);
  const chunkLabels = useMemo(() => traceChunkLabels(searchSteps), [searchSteps]);

  if (!model.available) {
    return (
      <div className="space-y-4">
        {model.plan && <SearchPlan plan={model.plan} />}
        <p role="status" className="rounded-(--radius) border border-dashed border-border-2 p-6 text-center text-[13px] text-muted">
          {streaming ? 'Waiting for the first search results…' : 'Trace not available — this answer was saved without its search events.'}
        </p>
        <Timeline items={model.timeline} streaming={streaming} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {model.plan && <SearchPlan plan={model.plan} />}
      {model.rounds.map((round) => (
        <section key={round.attempt ?? 'unknown'} aria-label={`Round ${round.attempt ?? ''}`} className="space-y-3">
          <h3 className="font-display text-[14px] font-semibold text-ink">
            {round.attempt != null ? `Round ${round.attempt}` : 'Round'}
            <span className="ml-2 text-[12px] font-normal text-muted">{round.queries.length} {round.queries.length === 1 ? 'query' : 'queries'}</span>
          </h3>
          {round.queries.map((group) => (
            <QueryCard key={group.query} query={group.query} candidates={group.candidates} rerank={group.rerank}
              streaming={streaming} chunkLabels={chunkLabels} />
          ))}
          {round.expansions.map((event, index) => <FinalContext key={event.eventId ?? index} event={event} chunkLabels={chunkLabels} />)}
        </section>
      ))}
      <Timeline items={model.timeline} streaming={streaming} />
    </div>
  );
};

const SearchInspectorModal = ({ steps, streaming, onClose }) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return createPortal(
    <dialog ref={dialogRef} aria-modal="true" aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-5xl overflow-hidden rounded-(--radius) border border-border bg-surface p-0 text-ink shadow-(--sh-lg) backdrop:bg-scrim/50">
      <div className="flex max-h-[90dvh] flex-col" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <h2 id={titleId} className="flex items-center gap-2 font-display text-lg font-semibold">
              Search Inspector
              {streaming && <span className="inline-flex items-center gap-1 rounded-full bg-blue-lt px-2 py-0.5 text-[11px] font-medium text-blue">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue" aria-hidden="true" />Live</span>}
            </h2>
            <p className="mt-1 text-[12px] text-muted">Which chunks each search method found, and how the reranker reordered them.</p>
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close search inspector" className="rounded p-2 hover:bg-surface-2"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <SearchInspectorContent steps={steps} streaming={streaming} />
        </div>
      </div>
    </dialog>,
    document.body
  );
};

/** The trigger, kept small: the timeline beside it already carries a lot. */
const SearchInspector = ({ steps = [], streaming }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue hover:underline">
        <ScanSearch className="h-3 w-3" aria-hidden="true" />
        Search Inspector
      </button>
      {open && <SearchInspectorModal steps={steps} streaming={streaming} onClose={() => setOpen(false)} />}
    </>
  );
};

export default SearchInspector;
