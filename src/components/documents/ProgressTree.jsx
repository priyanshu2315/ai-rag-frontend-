import { memo } from 'react';
import cn from '../../utils/cn';

/** A thin bar plus `3/6` — compact enough for hundreds of parents per document. */
const ChildProgress = ({ done, total }) => {
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const complete = Boolean(total) && done >= total;

  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="h-1 w-14 overflow-hidden rounded-full bg-border">
        <span
          className={cn('block h-full rounded-full transition-[width]', complete ? 'bg-green' : 'bg-blue')}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="mono w-9 text-right text-[10.5px] text-muted">
        {done}/{total ?? '?'}
      </span>
    </span>
  );
};

/** Memoised: a `child` event changes one parent, so the rest must not re-render. */
const ParentRow = memo(({ parent }) => (
  <li className="flex items-center gap-2.5 py-1 pl-3">
    <span className="mono shrink-0 rounded-(--radius-sm) bg-blue-lt px-1.5 py-0.5 text-[10px] font-semibold text-blue">
      P{parent.number}
    </span>
    <span className="min-w-0 flex-1 truncate text-[12px] text-ink-2" title={parent.preview}>
      {parent.preview ? `“${parent.preview}”` : '…'}
    </span>
    <ChildProgress done={parent.child} total={parent.totalChildren} />
  </li>
));
ParentRow.displayName = 'ParentRow';

const PageBlock = memo(({ page, totalPages }) => (
  <li className="py-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">
      Page {page.number}
      {totalPages ? ` of ${totalPages}` : ''}
    </p>
    <ul className="mt-0.5 ml-1 border-l-2 border-border-2">
      {page.parents.map((parent) => (
        <ParentRow key={parent.number} parent={parent} />
      ))}
    </ul>
  </li>
));
PageBlock.displayName = 'PageBlock';

/** Page → parent → child progress, growing as events arrive. */
const ProgressTree = ({ pages, totalPages }) => (
  <ul className="divide-y divide-border">
    {pages.map((page) => (
      <PageBlock key={page.number} page={page} totalPages={totalPages} />
    ))}
  </ul>
);

export default ProgressTree;
