import { memo } from 'react';
import { GAPS } from '../../constants/gaps';

/**
 * The limitations that are still standing, and what closing each one takes.
 *
 * Deliberately not on the pipeline's numbered rail: that rail reads as a
 * sequence of things done, and these are open. They get plain cards instead,
 * each carrying the same three beats — the gap, what it costs, the plan — so
 * the section reads as an audit rather than as a second timeline.
 */
const Gaps = memo(() => (
  <section className="mt-10">
    <div className="mb-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <h2 className="font-display text-[11px] font-semibold uppercase tracking-wider text-muted">
        Known gaps &amp; roadmap
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>

    <p className="mb-5 text-center text-[12px] leading-relaxed text-muted">
      A system&apos;s honest edges say more about its engineering than its feature list.
    </p>

    <ol className="space-y-3">
      {GAPS.map(({ id, title, gap, impact, plan, terms }) => (
        <li
          key={id}
          className="overflow-hidden rounded-(--radius) border border-border bg-surface shadow-(--sh-sm)"
        >
          <div className="flex items-start gap-2.5 border-b border-border p-3.5">
            <span className="mono mt-0.5 shrink-0 rounded-(--radius-sm) bg-amber-bg px-1.5 py-0.5 text-[10px] font-semibold text-amber">
              {id}
            </span>
            <h3 className="font-display text-[14px] font-semibold leading-snug text-ink">{title}</h3>
          </div>

          <div className="border-b border-border p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber">Gap</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{gap}</p>
          </div>

          <div className="border-b border-border p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Impact</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{impact}</p>
          </div>

          <div className="p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue">Plan</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{plan}</p>

            <ul className="mt-3 flex flex-wrap gap-1.5">
              {terms.map((term) => (
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
      ))}
    </ol>
  </section>
));

Gaps.displayName = 'Gaps';

export default Gaps;
