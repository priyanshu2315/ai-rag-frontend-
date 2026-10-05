import { memo, useState } from 'react';
import { Check, ChevronRight, Loader2, Search } from 'lucide-react';
import cn from '../../utils/cn';
import SearchEventDetails from './SearchEventDetails';
import { JsonDetails } from '../chunks/ChunkInspection';

const GRAPH_KINDS = new Set([
  'retrieval', 'retrieval_candidates', 'rerank_result', 'neighbor_expansion',
  'grading_result', 'generation_context',
]);

const RetrievalDetails = ({ event }) => {
  const data = event.data ?? event;
  const groups = [
    ['Directly retrieved parents', data.retrievedParents],
    ['Added neighbors', data.addedNeighbors],
    ['Grading decisions', data.gradingDecisions],
  ];
  return (
    <div className="mt-1 space-y-1 text-[11px] text-muted">
      {groups.filter(([, items]) => Array.isArray(items)).map(([label, items]) => (
        <p key={label}><strong className="text-ink-2">{label}:</strong> {items.length ? items.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join(', ') : 'None'}</p>
      ))}
      <details>
        <summary className="cursor-pointer hover:text-ink">Exact retrieval event</summary>
        <pre className="mt-1 max-h-52 overflow-auto whitespace-pre-wrap break-all rounded-(--radius-sm) bg-surface-2 p-2">{JSON.stringify(event, null, 2)}</pre>
      </details>
    </div>
  );
};

/**
 * One node on the rail. A tool gets an icon because it is the step that
 * actually went and did something; a status transition is just a dot.
 */
const StepNode = ({ step, isLast }) => (
  <li className="grid grid-cols-[1rem_1fr] gap-x-2.5">
    <div className="flex flex-col items-center">
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
          step.done ? 'border-border-2 bg-surface text-green' : 'border-blue bg-blue-lt text-blue'
        )}
      >
        {!step.done && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
        {step.done && step.kind === 'tool_start' && <Search className="h-2 w-2" />}
        {step.done && step.kind !== 'tool_start' && <Check className="h-2.5 w-2.5" />}
      </span>

      {/* The rail needs the row to be taller than the dot to show at all —
          hence the padding below, which is what gives it its length. */}
      {!isLast && <span className="mt-1 w-0 flex-1 border-l-2 border-dotted border-border-2" />}
    </div>

    <div className={cn('min-w-0', isLast ? 'pb-0' : 'pb-3.5')}>
      <span className="mono text-[10px] text-muted-2">{step.kind}</span>
      <p className={cn('text-[12px] leading-snug', step.done ? 'text-ink-2' : 'font-medium text-ink')}>
        {step.label}{step.kind === 'token' ? ` · ${step.count} ${step.count === 1 ? 'fragment' : 'fragments'}` : ''}
      </p>

      {step.query && (
        <p className="mono mt-0.5 break-words text-[11px] leading-snug text-muted">“{step.query}”</p>
      )}

      {step.detail && (
        <p className="mt-0.5 break-words text-[11px] leading-snug text-muted">{step.detail}</p>
      )}
      {step.kind === 'retrieval' && <RetrievalDetails event={step.event} />}
      {GRAPH_KINDS.has(step.kind) && step.kind !== 'retrieval' && <SearchEventDetails event={step.event} />}
      {step.kind === 'tool_finish' && step.event && (
        <>
          {Array.isArray(step.event.queries) && <p className="mt-1 text-[11px] text-muted">Queries: {step.event.queries.join(', ')}</p>}
          {step.event.intent && <p className="mt-1 text-[11px] text-muted">Intent: {step.event.intent}</p>}
          {step.event.pageNumber != null && <p className="mt-1 text-[11px] text-muted">Page: {step.event.pageNumber}</p>}
          {step.event.query && <p className="mt-1 text-[11px] text-muted">Rewritten query: {step.event.query}</p>}
          <JsonDetails className="mt-1 text-[11px] text-muted" title="Exact tool event" value={step.event} />
        </>
      )}
    </div>
  </li>
);

/**
 * How the agent got to an answer: every status transition, tool call and stream result it
 * made, on the same dotted rail the About page uses for the build pipeline —
 * the two are the same idea, one at design time and one per question.
 *
 * It runs open while the agent works, because that is when the user is waiting
 * and wants to know why. Once the answer lands the reasoning is scaffolding,
 * so it folds itself away — unless the user opened it deliberately, in which
 * case their choice outranks the default.
 */
const AnswerTimeline = memo(({ steps, streaming, separated }) => {
  const [choice, setChoice] = useState(null);
  const [advanced, setAdvanced] = useState(false);
  const open = choice ?? streaming;
  const basicSteps = steps.filter((step) => !GRAPH_KINDS.has(step.kind));
  const shownSteps = advanced ? steps : basicSteps;
  const graphCount = steps.length - basicSteps.length;

  return (
    <div className={cn(separated && 'mb-3 border-b border-border pb-3')}>
      <button
        type="button"
        onClick={() => setChoice(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2 transition-colors hover:text-muted"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        {streaming ? 'Working' : `How this was answered · ${basicSteps.length} steps`}
      </button>

      {open && (
        <>
          <button type="button" onClick={() => setAdvanced((current) => !current)} aria-expanded={advanced} className="mt-2 text-[11px] font-medium text-blue hover:underline">
            {advanced ? 'Hide' : 'Show'} advanced search details · {graphCount} events
          </button>
          <ol className="mt-2.5">
            {shownSteps.map((step, index) => (
              <StepNode key={step.id} step={step} isLast={index === shownSteps.length - 1} />
            ))}
          </ol>
        </>
      )}
      {open && advanced && graphCount === 0 && (
        <p className="mt-2 text-[11px] text-muted">No structured search events were supplied by this stream.</p>
      )}
    </div>
  );
});

AnswerTimeline.displayName = 'AnswerTimeline';

export default AnswerTimeline;
