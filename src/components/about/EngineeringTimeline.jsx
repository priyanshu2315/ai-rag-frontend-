import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { SearchX, X } from 'lucide-react';
import cn from '../../utils/cn';
import TextField from '../inputs/TextField';
import Button from '../buttons/Button';
import Skeleton from '../feedback/Skeleton';
import ErrorState from '../feedback/ErrorState';
import EmptyState from '../feedback/EmptyState';
import TimelineEntry from './TimelineEntry';
import usePipeline from '../../hooks/usePipeline';
import { filterPhases, groupByMonth, newestIds, orderPhases } from '../../utils/pipelineTimeline';

const ORDERS = [['newest', 'Newest first'], ['oldest', 'Oldest first']];

const LoadingCards = () => (
  <div className="space-y-3" role="status" aria-label="Loading timeline">
    {[0, 1, 2].map((key) => (
      <div key={key} className="space-y-2 rounded-(--radius) border border-border bg-surface p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-3 w-full" />
      </div>
    ))}
  </div>
);

/**
 * The Engineering Timeline, from `GET /pipeline` — the backend is the only
 * copy of this write-up now. Newest first by default; search and a term
 * filter narrow it, and the month headings regroup whatever is left.
 */
export const TimelineView = ({ phases, total, status, error, onRetry }) => {
  const { control, setValue } = useForm({ defaultValues: { query: '' } });
  const query = useWatch({ control, name: 'query' });
  // Filtering 50-odd cards per keystroke is cheap, but not free on a phone.
  const deferredQuery = useDeferredValue(query);
  const [term, setTerm] = useState(null);
  const [order, setOrder] = useState('newest');
  // null until the reader toggles something: until then the newest three are open.
  const [expanded, setExpanded] = useState(null);

  const openIds = useMemo(() => expanded ?? new Set(newestIds(phases)), [expanded, phases]);
  const visible = useMemo(() => orderPhases(filterPhases(phases, { query: deferredQuery, term }), order),
    [phases, deferredQuery, term, order]);
  const groups = useMemo(() => groupByMonth(visible), [visible]);

  const toggle = useCallback((id) => setExpanded((current) => {
    const next = new Set(current ?? newestIds(phases));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), [phases]);

  const pickTerm = useCallback((value) => setTerm((current) => (current === value ? null : value)), []);
  const clearFilters = () => {
    setTerm(null);
    setValue('query', '');
  };

  return (
    <section aria-labelledby="engineering-timeline" className="pb-10">
      <h2 id="engineering-timeline" className="font-display text-lg font-semibold text-ink">Engineering Timeline</h2>
      <p className="mt-1 text-[13px] text-muted">Every problem hit while building DocuMind, and what fixed it.</p>

      <div className="mt-4 space-y-2">
        <Controller
          name="query"
          control={control}
          render={({ field }) => (
            <TextField {...field} type="search" label="Search" placeholder="Title, problem, solution or term" autoComplete="off" />
          )}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted">
            {status === 'succeeded' && <span role="status">Showing {visible.length} of {total}</span>}
            {term && (
              <button type="button" onClick={() => setTerm(null)} aria-label={`Clear term filter: ${term}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue bg-blue-lt px-2 py-0.5 text-[11px] text-blue">
                <span className="break-words text-left">{term}</span>
                <X className="h-3 w-3 shrink-0" aria-hidden="true" />
              </button>
            )}
          </div>
          <div role="group" aria-label="Order" className="inline-flex rounded-(--radius-sm) border border-border-2 p-0.5">
            {ORDERS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={order === id} onClick={() => setOrder(id)}
                className={cn('rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition-colors',
                  order === id ? 'bg-blue-lt text-blue' : 'text-muted hover:text-ink')}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        {(status === 'idle' || status === 'loading') && <LoadingCards />}
        {status === 'failed' && <ErrorState message={error ?? 'Could not load the engineering timeline.'} onRetry={onRetry} />}
        {status === 'succeeded' && visible.length === 0 && (
          <EmptyState icon={SearchX} title="No matching entries" description="Try another search, or clear the filters."
            action={<Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>} />
        )}
        {status === 'succeeded' && groups.map((group) => (
          <div key={group.month} className="mb-6 last:mb-0">
            <h3 className="mono mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-2">{group.month}</h3>
            <ol className="ml-1 border-l-2 border-dotted border-border-2">
              {group.phases.map((phase) => (
                <TimelineEntry key={phase.id} phase={phase} expanded={openIds.has(phase.id)} onToggle={toggle}
                  activeTerm={term} onTerm={pickTerm} />
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
};

const EngineeringTimeline = () => {
  const { phases, total, status, error, retry } = usePipeline();
  return <TimelineView phases={phases} total={total} status={status} error={error} onRetry={retry} />;
};

export default EngineeringTimeline;
