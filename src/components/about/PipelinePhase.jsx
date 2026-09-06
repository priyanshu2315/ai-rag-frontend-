import { memo } from 'react';
import cn from '../../utils/cn';

/**
 * One phase of the timeline: a numbered node on the rail, then the problem,
 * the solution, and the technical terms.
 *
 * The rail is drawn per row rather than as one border on the list, so the
 * dotted line can stop cleanly at the last node instead of running past it.
 */
const PipelinePhase = memo(({ phase, index, isLast }) => (
  <li className="grid grid-cols-[2.25rem_1fr] gap-x-4 sm:gap-x-5">
    <div className="flex flex-col items-center">
      <span className="mono flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-2 bg-surface text-[12px] font-semibold text-blue shadow-(--sh-sm)">
        {index + 1}
      </span>
      {!isLast && <span className="mt-2 w-0 flex-1 border-l-2 border-dotted border-border-2" />}
    </div>

    <div className={cn(isLast ? 'pb-2' : 'pb-10')}>
      <h3 className="font-display text-[15px] font-semibold leading-snug text-ink">
        {phase.title}
      </h3>

      <div className="mt-3 overflow-hidden rounded-(--radius) border border-border bg-surface shadow-(--sh-sm)">
        <div className="border-b border-border p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-red">Problem</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{phase.problem}</p>
        </div>

        <div className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-green">Solution</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{phase.solution}</p>
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
        Technical Terms
      </p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {phase.terms.map((term) => (
          <li
            key={term}
            className="rounded-(--radius-sm) border border-border bg-surface-2 px-2 py-1 text-[11px] text-muted"
          >
            {term}
          </li>
        ))}
      </ul>
    </div>
  </li>
));

PipelinePhase.displayName = 'PipelinePhase';

export default PipelinePhase;
