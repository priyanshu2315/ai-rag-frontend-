import { memo, useId } from 'react';
import { ChevronRight } from 'lucide-react';
import cn from '../../utils/cn';
import { previewText } from '../../utils/pipelineTimeline';

const Block = ({ label, tone, children }) => (
  <div>
    <p className={cn('text-[11px] font-semibold uppercase tracking-wider', tone)}>{label}</p>
    <p className="mt-1 max-w-[70ch] whitespace-pre-line break-words text-[13px] leading-relaxed text-ink-2">{children}</p>
  </div>
);

/**
 * One phase on the rail. Collapsed it is a title, a date and the start of the
 * problem; expanded it is the whole write-up. Term chips filter the timeline,
 * so they sit outside the toggle — a button cannot hold other buttons.
 */
const TimelineEntry = memo(({ phase, expanded, onToggle, activeTerm, onTerm }) => {
  const bodyId = useId();
  return (
    <li className="relative pb-4 pl-5 last:pb-0">
      {/* Anchored by the `relative` row, so it never escapes the page's scroll area. */}
      <span aria-hidden="true" className={cn('absolute top-4 -left-[5px] h-2 w-2 rounded-full ring-2 ring-bg', expanded ? 'bg-blue' : 'bg-border-2')} />
      <article className="rounded-(--radius) border border-border bg-surface shadow-(--sh-sm)">
        <button type="button" onClick={() => onToggle(phase.id)} aria-expanded={expanded} aria-controls={bodyId}
          className="flex w-full items-start gap-2 p-3.5 text-left transition-colors hover:bg-surface-2 sm:p-4">
          <ChevronRight className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-2 transition-transform', expanded && 'rotate-90 text-blue')} />
          <span className="min-w-0 flex-1">
            <span className="block break-words font-display text-[14px] font-semibold leading-snug text-ink">{phase.title}</span>
            {phase.date && <span className="mono mt-0.5 block text-[11px] text-muted-2">{phase.date}</span>}
            {!expanded && phase.problem && (
              <span className="mt-1.5 block max-w-[70ch] break-words text-[12px] leading-relaxed text-muted">{previewText(phase.problem)}</span>
            )}
          </span>
        </button>

        {expanded && (
          <div id={bodyId} className="space-y-3 border-t border-border p-3.5 sm:p-4">
            {phase.problem && <Block label="Problem" tone="text-red">{phase.problem}</Block>}
            {phase.solution && <Block label="Solution" tone="text-green">{phase.solution}</Block>}
            {phase.terms.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Terms">
                {phase.terms.map((term) => (
                  <li key={term}>
                    <button type="button" onClick={() => onTerm(term)} aria-pressed={activeTerm === term}
                      title={`Show entries about ${term}`}
                      className={cn('rounded-full border px-2 py-0.5 text-left text-[11px] transition-colors',
                        activeTerm === term ? 'border-blue bg-blue-lt text-blue' : 'border-border bg-surface-2 text-muted hover:border-border-2 hover:text-ink')}>
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </article>
    </li>
  );
});

TimelineEntry.displayName = 'TimelineEntry';

export default TimelineEntry;
