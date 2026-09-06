import { memo } from 'react';
import cn from '../../utils/cn';
import { GLOSSARY } from '../../constants/glossary';

const DOT_CLASSES = {
  blue: 'bg-blue',
  green: 'bg-green',
  purple: 'bg-purple',
  amber: 'bg-amber',
  teal: 'bg-teal',
};

/**
 * The concepts behind the build, defined.
 *
 * Definition lists rather than cards per term: there are twenty-odd of these
 * and each is two lines, so the page reads down a column instead of hunting
 * across a grid. Groups carry the same colour dots as the platform cards
 * above, which is what ties the two sections together.
 */
const Glossary = memo(() => (
  <section className="mt-10">
    <div className="mb-6 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <h2 className="font-display text-[11px] font-semibold uppercase tracking-wider text-muted">
        Concepts
      </h2>
      <span className="h-px flex-1 bg-border" />
    </div>

    <div className="space-y-6">
      {GLOSSARY.map(({ group, color, terms }) => (
        <div key={group}>
          <div className="mb-2 flex items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT_CLASSES[color])} />
            <h3 className="font-display text-[13px] font-semibold text-ink">{group}</h3>
            <span className="text-[11px] text-muted-2">{terms.length}</span>
          </div>

          <dl className="divide-y divide-border overflow-hidden rounded-(--radius) border border-border bg-surface shadow-(--sh-sm)">
            {terms.map(({ term, definition }) => (
              <div key={term} className="p-3.5">
                <dt className="text-[12.5px] font-semibold text-ink">{term}</dt>
                <dd className="mt-1 text-[12px] leading-relaxed text-muted">{definition}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  </section>
));

Glossary.displayName = 'Glossary';

export default Glossary;
