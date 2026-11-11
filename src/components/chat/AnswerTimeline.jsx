import { memo, useId, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import cn from '../../utils/cn';
import { JsonDetails } from '../chunks/ChunkInspection';
import ChunkId from '../chunks/ChunkId';
import ChunkViewButton from '../chunks/ChunkViewer';
import CopyButton from '../buttons/CopyButton';
import ReferenceFlow from './ReferenceFlow';
import TaskEvidence from './TaskEvidence';
import { buildTaskEvidence } from '../../utils/taskEvidence';
import useTraceSteps from '../../hooks/useTraceSteps';
import useAutoScroll from '../../hooks/useAutoScroll';
import SearchingMark from './SearchingMark';
import { observedChunks } from '../../utils/crossReferences';
import {
  MATCH_LABELS, MATCH_ORDER, STATUSES, STATUS_LABELS, buildAnswerTrace, formatRerankScore, intentLine, liveStage, summaryLine,
} from '../../utils/answerTrace';

const DOTS = {
  found: 'bg-muted-2',
  top: 'bg-blue',
  nearby: 'bg-purple',
  rejected: 'bg-red/50',
  used: 'bg-green',
};

// Labelled with aria-label rather than an `sr-only` child: that child is
// absolutely positioned, and from inside the chat's scroll area it lands
// against the page instead, stretching the whole app into a scrolling page.
const StatusDot = ({ status }) => (
  <span role="img" aria-label={STATUS_LABELS[status]} title={STATUS_LABELS[status]}
    className={cn('inline-block h-2 w-2 shrink-0 rounded-full', DOTS[status])} />
);

const Badge = ({ children }) => (
  <span className="rounded-full border border-border px-1.5 text-[10px] leading-4 text-muted">{children}</span>
);

const MatchBadges = ({ matchedBy }) => matchedBy.map((source) => <Badge key={source}>{MATCH_LABELS[source]}</Badge>);

/** "#14 → #1 (0.98)": search rank, rerank rank and its score — always from one search. */
const rankText = (retrievalRank, rerankRank, rerankScore) => {
  const score = rerankRank != null && formatRerankScore(rerankScore);
  const reranked = rerankRank != null ? `#${rerankRank}${score ? ` (${score})` : ''}` : null;
  if (retrievalRank != null && reranked) return `#${retrievalRank} → ${reranked}`;
  if (retrievalRank != null) return `#${retrievalRank}`;
  return reranked ? `→ ${reranked}` : null;
};

/** Where a final chunk came from — the same record its ranks were read from. */
const provenance = ({ origin }) => {
  if (origin?.kind === 'nearby') {
    return ['Nearby', `neighbor of ${origin.seedLabel ?? 'an unknown section'}`, origin.round != null && `round ${origin.round}`].filter(Boolean).join(' · ');
  }
  if (origin?.kind === 'search') return `Round ${origin.round}${origin.query ? ` · “${origin.query}”` : ''}`;
  return 'Supplied with the answer context';
};

/** The ranks a final card shows: its one search's, or none for a nearby chunk. */
const originRanks = (origin) => (origin?.kind === 'search'
  ? { retrievalRank: origin.retrievalRank, rerankRank: origin.rerankRank, rerankScore: origin.rerankScore }
  : { retrievalRank: null, rerankRank: null, rerankScore: null });

/** What the chunk viewer shows: the row's own view of the chunk, plus the ledger's. */
const viewerChunk = ({ id, status, page, headingPath, matchedBy, ranks, entry, note }) => ({
  id,
  text: entry?.text,
  searchText: entry?.searchText,
  documentTitle: entry?.documentTitle,
  page,
  heading: headingPath.join(' › '),
  meta: [
    ['Status', STATUS_LABELS[status]],
    ['Matched by', matchedBy.map((source) => MATCH_LABELS[source]).join(', ')],
    ['Rank', ranks && `${ranks} (search → rerank)`],
    ['Rerank', note],
    ['Came from', entry?.status === 'used' ? provenance(entry) : null],
    ['Searches', entry?.queries?.join(' · ')],
  ],
});

/** The one-line chunk summary every list shares. Never the full text — "View" opens that. */
const ChunkRow = ({ id, status, page, headingPath = [], matchedBy = [], retrievalRank, rerankRank, rerankScore, entry, note }) => {
  const ranks = rankText(retrievalRank, rerankRank, rerankScore);
  return (
    <span className={cn('flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]', status === 'rejected' ? 'text-muted' : 'text-ink-2')}>
      <StatusDot status={status} />
      <span className="mono">p.{page ?? '?'}</span>
      {headingPath.length > 0 && <span className="min-w-0 max-w-full truncate">· {headingPath[headingPath.length - 1]}</span>}
      <MatchBadges matchedBy={matchedBy} />
      {ranks && <span className="mono text-muted">{ranks}</span>}
      {note && <span className="rounded-full border border-red/30 px-1.5 text-[10px] leading-4 text-red">{note}</span>}
      <ChunkId id={id} />
      <ChunkViewButton chunk={viewerChunk({ id, status, page, headingPath, matchedBy, ranks, entry, note })} />
    </span>
  );
};

/** Two lines until clicked. */
const TextPreview = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  return (
    <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}
      className={cn('mt-1 block w-full break-words text-left text-[12px] leading-snug text-muted hover:text-ink-2',
        expanded ? 'whitespace-pre-wrap' : 'line-clamp-2')}>
      {text}
    </button>
  );
};

const FinalChunks = ({ trace, steps, streaming, onReferenceSelect }) => {
  const evidence = useMemo(() => observedChunks(steps), [steps]);
  return (
    <div>
      {trace.final?.contextLimited && <p className="mb-2 text-[11px] text-amber">Some evidence was cut to fit.</p>}
      {trace.used.length === 0 ? (
        <p className="text-[12px] text-muted">{streaming ? 'The chunks used will appear once the answer starts.' : 'No chunks were recorded for this answer.'}</p>
      ) : (
        <ul className="divide-y divide-border">
          {trace.used.map((chunk) => (
            <li key={chunk.id} className="py-2 first:pt-0 last:pb-0">
              <ChunkRow {...chunk} {...originRanks(chunk.origin)} entry={chunk} />
              {chunk.headingPath.length > 1 && <p className="mt-0.5 break-words text-[11px] text-muted">{chunk.headingPath.join(' › ')}</p>}
              <TextPreview text={chunk.text} />
              <p className="mt-1 break-words text-[11px] text-muted-2">{provenance(chunk)}</p>
            </li>
          ))}
        </ul>
      )}
      <ReferenceFlow chunks={evidence} onSelect={onReferenceSelect} />
    </div>
  );
};

const circled = (index) => (index < 20 ? String.fromCharCode(0x2460 + index) : `${index + 1}.`);

const Legend = () => (
  <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
    {STATUSES.map((status) => <span key={status} className="inline-flex items-center gap-1"><StatusDot status={status} />{STATUS_LABELS[status]}</span>)}
  </p>
);

/** `active` marks the step a live answer is on: its number becomes the working mark. */
const Stage = ({ index, title, active = false, children }) => (
  <li className="grid grid-cols-[1.25rem_1fr] gap-x-1.5" aria-current={active ? 'step' : undefined}>
    {active
      ? <SearchingMark label="In progress" className="mt-0.5" />
      : <span className="text-[13px] leading-5 text-muted" aria-hidden="true">{circled(index)}</span>}
    <div className="min-w-0 pb-3">
      {title && <p className="text-[12px] font-semibold leading-5 text-ink">{title}</p>}
      <div className="text-[12px] text-ink-2">{children}</div>
    </div>
  </li>
);

const Chip = ({ label, value }) => (
  <span className="rounded-full bg-surface-2 px-1.5 text-[10px] leading-4 text-muted"><span className="text-muted-2">{label}</span> {value}</span>
);

const Hops = ({ hops, plan }) => hops.length > 0 && (
  <ul className="mt-1 space-y-0.5">
    {hops.map((hop, index) => {
      const task = plan?.hopPlan.find((item) => item.id === hop.hopId)?.task;
      const resolved = hop.status === 'resolved';
      return (
        <li key={hop.hopId ?? index} className="break-words text-[11px]">
          <span aria-hidden="true">{resolved ? '✅' : '⏳'}</span>{' '}
          {task && <span className="text-muted">{task}: </span>}
          <span className={resolved ? 'text-ink-2' : 'text-muted'}>{(resolved ? hop.value : hop.reason) || (resolved ? 'Resolved' : 'Pending')}</span>
        </li>
      );
    })}
  </ul>
);

const Decision = ({ decision }) => {
  if (!decision) return null;
  if (decision.kind === 'stop') return <p className="text-[11px] text-ink-2">■ Stopped: {decision.label}</p>;
  if (decision.kind === 'follow_up') return <p className="break-words text-[11px] text-ink-2">↻ Follow-up search: {decision.query}</p>;
  return <p className="break-words text-[11px] text-ink-2">↻ Rewriting search{decision.query ? `: ${decision.query}` : ''}</p>;
};

const Search = ({ search, byId }) => (
  <li className="py-2 first:pt-0 last:pb-0">
    <p className="break-words text-[12px] text-ink">{search.query || 'Query text unavailable'}</p>
    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
      <span>Found {search.found} → kept {search.kept ?? '…'}</span>
      {MATCH_ORDER.filter((source) => search.counts[source] > 0).map((source) => (
        <Badge key={source}>{MATCH_LABELS[source]} {search.counts[source]}</Badge>
      ))}
    </p>
    {search.rerankFailed && <p className="mt-0.5 text-[11px] text-amber">Reranker failed — used search order</p>}
    {search.documents.length > 0 && (
      <details className="mt-1">
        <summary className="cursor-pointer text-[11px] text-blue">Show {search.documents.length} found chunks</summary>
        <ul className="mt-1 space-y-1">
          {search.documents.map((doc, index) => {
            const entry = byId.get(doc.id);
            return (
              <li key={doc.id ?? index}>
                <details>
                  <summary className="cursor-pointer list-none">
                    <ChunkRow id={doc.id} status={entry?.status ?? 'found'} page={entry?.page} headingPath={entry?.headingPath}
                      matchedBy={MATCH_ORDER.filter((source) => doc.matchedBy?.includes(source))}
                      retrievalRank={doc.retrievalRank} rerankRank={search.rerankRanks.get(doc.id)}
                      rerankScore={search.rerankScores.get(doc.id)} entry={entry}
                      note={search.dropped.has(doc.id) ? 'dropped by rerank' : null} />
                  </summary>
                  <TextPreview text={entry?.text} />
                </details>
              </li>
            );
          })}
        </ul>
      </details>
    )}
  </li>
);

const Round = ({ round, plan, byId }) => {
  const found = round.searches.reduce((sum, search) => sum + search.found, 0);
  const kept = round.searches.reduce((sum, search) => sum + (search.kept ?? 0), 0);
  return (
    <details open={round.isLast} className="rounded-(--radius-sm) border border-border">
      <summary className="cursor-pointer px-2.5 py-1.5 text-[12px]">
        <span className="font-semibold text-ink">Round {round.attempt}</span>
        <span className="text-muted"> · {round.searches.length} {round.searches.length === 1 ? 'search' : 'searches'} · found {found} → kept {kept}</span>
      </summary>
      <div className="space-y-2 border-t border-border px-2.5 py-2">
        {round.searches.length > 0 && <ul className="divide-y divide-border">{round.searches.map((search) => <Search key={search.query} search={search} byId={byId} />)}</ul>}
        {round.nearby > 0 && <p className="text-[11px] text-purple">+{round.nearby} nearby {round.nearby === 1 ? 'chunk' : 'chunks'} added</p>}
        {round.check && (
          <div>
            <p className="text-[11px] text-muted">Check · kept {round.check.kept} of {round.check.total}</p>
            <Hops hops={round.check.hops} plan={plan} />
          </div>
        )}
        <Decision decision={round.decision} />
      </div>
    </details>
  );
};

export const StepByStep = ({ trace, streaming, live = null, steps = [] }) => {
  const { plan, rounds, final } = trace;
  // Only once the answer context exists; older messages have none of this and skip the step.
  const tasks = useMemo(() => (final ? buildTaskEvidence(steps) : null), [final, steps]);
  let index = 0;
  return (
    <div>
      <Legend />
      <ol>
        <Stage index={index++} title="Understood">
          {trace.intent ? (trace.searchIntent ? 'Search the documents' : intentLine(trace.intent, trace.pageNumber)) : 'Question received'}
        </Stage>
        <Stage index={index++} title="Plan" active={live?.stage === 'plan'}>
          {!plan && <span className="text-muted">{streaming ? 'Planning…' : 'No plan recorded.'}</span>}
          {plan?.hopPlan.length > 0 && (
            <>
              <p className="mt-0.5 text-[11px] font-medium text-muted">Tasks</p>
              <ol className="space-y-0.5">
                {plan.hopPlan.map((hop) => (
                  <li key={hop.id} className="break-words text-[12px]">
                    <span className="mono text-[11px] text-muted">{hop.id}</span> {hop.task}
                    {hop.dependsOn?.length > 0 && <span className="text-[11px] text-muted-2"> · after {hop.dependsOn.join(', ')}</span>}
                  </li>
                ))}
              </ol>
            </>
          )}
          {plan && (plan.searchTiers.length > 0 || plan.queries.length > 0) && (
            <>
              <p className="mt-1.5 text-[11px] font-medium text-muted">Searches</p>
              <ul className="space-y-1">
                {(plan.searchTiers.length ? plan.searchTiers : plan.queries.map((query) => ({ text: query }))).map((tier, tierIndex) => (
                  <li key={`${tier.text}-${tierIndex}`} className="break-words">
                    <span>{tier.text}</span>
                    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
                      {(tier.identifiers ?? []).map((value) => <Chip key={`i-${value}`} label="ID" value={value} />)}
                      {(tier.entities ?? []).map((value) => <Chip key={`e-${value}`} label="Name" value={value} />)}
                      {(tier.keywords ?? []).map((value) => <Chip key={`k-${value}`} label="Word" value={value} />)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Stage>
        {live?.stage === 'search' && (
          <Stage index={index++} title="Round 1" active><span className="text-muted">Searching…</span></Stage>
        )}
        {rounds.map((round) => (
          <Stage key={round.attempt} index={index++} active={live?.stage === 'round' && live.attempt === round.attempt}>
            <Round round={round} plan={plan} byId={trace.byId} />
          </Stage>
        ))}
        {tasks && <Stage index={index++} title="Tasks"><TaskEvidence data={tasks} /></Stage>}
        <Stage index={index++} title="Answer" active={live?.stage === 'answer'}>
          {!final ? <span className="text-muted">{live?.stage === 'answer' ? 'Writing…' : streaming ? 'Gathering evidence…' : 'No answer context recorded.'}</span> : (
            <>
              <p className="text-[11px] text-muted">
                {trace.used.length} {trace.used.length === 1 ? 'chunk' : 'chunks'} used
                {final.isComplete === true && ' · all tasks answered'}
                {final.isComplete === false && ' · some tasks unanswered'}
              </p>
              {final.contextLimited && <p className="text-[11px] text-amber">Some evidence was cut to fit.</p>}
              <Hops hops={final.hops} plan={plan} />
            </>
          )}
        </Stage>
      </ol>
    </div>
  );
};

export const Developer = ({ trace }) => (
  <div className="space-y-1.5 text-[11px] text-muted">
    {trace.plan && <JsonDetails title="Plan · Question Splitter" value={trace.plan.event} />}
    {trace.rounds.map((round) => (
      <div key={round.attempt} className="space-y-1.5">
        <p className="pt-1 font-semibold text-ink-2">Round {round.attempt}</p>
        {round.searches.map((search) => (
          <div key={search.query} className="space-y-1 pl-2">
            <p className="break-words text-ink-2">{search.query}</p>
            {search.candidates && <JsonDetails title="Search inputs" value={search.candidates.searchInputs ?? null} />}
            {search.candidates && <JsonDetails title={`Candidates · scores and ranks · ${search.found}`} value={search.candidates.documents} />}
            {search.rerank && <JsonDetails title={`Rerank result · ${search.kept}`} value={search.rerank} />}
          </div>
        ))}
        {round.expansions.map((event, index) => <JsonDetails key={event.eventId ?? index} title="Neighbor expansion" value={event} />)}
        {round.grading && <JsonDetails title="Grading response" value={round.grading.gradingResponse ?? round.grading} />}
        {round.grading && <JsonDetails title="Grading event" value={round.grading} />}
      </div>
    ))}
    {trace.final?.contextText && (
      <details>
        <summary className="cursor-pointer font-medium hover:text-ink">Context text</summary>
        <div className="mt-1 flex justify-end"><CopyButton text={trace.final.contextText} label="Copy context" /></div>
        <pre className="mono mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-(--radius-sm) bg-surface-2 p-2 text-[11px] text-ink-2">{trace.final.contextText}</pre>
      </details>
    )}
    {trace.final && <JsonDetails title="Generation context" value={trace.final.event} />}
    {trace.validationWarnings.length > 0 && <JsonDetails title={`Validation warnings · ${trace.validationWarnings.length}`} value={trace.validationWarnings} />}
    {(trace.usage || trace.stepCosts.length > 0) && <JsonDetails title="Cost breakdown" value={{ total: trace.usage, steps: trace.stepCosts }} />}
  </div>
);

const TABS = [['final', 'Final chunks'], ['steps', 'Step by step'], ['developer', 'Developer']];

/**
 * "How this was answered" — what was searched, found, kept and used, instead
 * of one row per stream event.
 *
 * A saved answer starts collapsed: the summary line is the answer to "what did
 * it do", the tabs are for when that is not enough. A live one starts open on
 * Step by step instead, so the search is watched rather than waited on — the
 * panel mounts with the first event, while `streaming` is still true. After
 * that, open/closed and the tab are the user's.
 */
const AnswerTimeline = memo(({ steps, streaming, separated, onReferenceSelect, copyText, actions, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen || streaming);
  const [tab, setTab] = useState(streaming ? 'steps' : 'final');
  const tabsId = useId();
  const traceSteps = useTraceSteps(steps);
  const trace = useMemo(() => buildAnswerTrace(traceSteps), [traceSteps]);
  // `separated` is "answer text has started" — the bubble draws the divider then.
  const live = streaming ? liveStage(trace, { writing: Boolean(separated) }) : null;

  // Keep the newest round in view while it streams in. Only then: once the
  // answer settles, or on another tab, expanding a row must not jump the list.
  const follow = streaming && tab === 'steps';
  const { containerRef, contentRef } = useAutoScroll([]);

  const tools = (copyText != null || actions) && (
    <span className="flex items-center gap-3">
      {copyText != null && <CopyButton text={copyText} label="Copy everything" />}
      {actions}
    </span>
  );

  if (!trace.searchIntent) {
    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px] text-muted', separated && 'mb-3 border-b border-border pb-3')}>
        <span>{intentLine(trace.intent, trace.pageNumber)}</span>
        {tools}
      </div>
    );
  }

  return (
    <div className={cn(separated && 'mb-3 border-b border-border pb-3')}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}
          className="flex min-w-0 items-start gap-1.5 text-left">
          <ChevronRight className={cn('mt-0.5 h-3 w-3 shrink-0 text-muted-2 transition-transform', open && 'rotate-90')} />
          {live && <SearchingMark label={`In progress: ${live.label}`} />}
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted-2 hover:text-muted">How this was answered</span>
            <span className="block break-words text-[11px] text-muted">
              {live && <span className="font-medium text-blue">{live.label} · </span>}{summaryLine(trace)}
            </span>
          </span>
        </button>
        {tools}
      </div>

      {open && (
        <div className="mt-2.5">
          <div role="tablist" aria-label="Answer trace views" className="flex gap-1 border-b border-border">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`${tabsId}-${id}`} aria-selected={tab === id} aria-controls={`${tabsId}-panel`}
                onClick={() => setTab(id)}
                className={cn('-mb-px border-b-2 px-2 py-1 text-[11px] font-medium transition-colors',
                  tab === id ? 'border-blue text-blue' : 'border-transparent text-muted hover:text-ink')}>
                {label}{id === 'final' && trace.used.length > 0 && ` · ${trace.used.length}`}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`${tabsId}-panel`} aria-labelledby={`${tabsId}-${tab}`} ref={follow ? containerRef : undefined}
            className="max-h-[60dvh] overflow-y-auto overscroll-contain pt-2.5 pr-1">
            <div ref={follow ? contentRef : undefined}>
              {tab === 'final' && <FinalChunks trace={trace} steps={traceSteps} streaming={streaming} onReferenceSelect={onReferenceSelect} />}
              {tab === 'steps' && <StepByStep trace={trace} streaming={streaming} live={live} steps={traceSteps} />}
              {tab === 'developer' && <Developer trace={trace} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

AnswerTimeline.displayName = 'AnswerTimeline';

export default AnswerTimeline;
