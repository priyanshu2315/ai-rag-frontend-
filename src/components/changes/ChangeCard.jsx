import { memo, useMemo } from 'react';
import { Badge } from '../badges/StatusBadge';
import { LINE, diffLines, lineSummary, markAll, onlyChanged, pagesText } from '../../utils/lineDiff';
import cn from '../../utils/cn';

const LINE_CLASS = {
  [LINE.CONTEXT]: 'text-muted',
  [LINE.ADDED]: 'bg-green-bg text-green',
  [LINE.REMOVED]: 'bg-red-bg text-red',
};

const STRIKE = 'line-through decoration-red/60';

const MARK = { [LINE.CONTEXT]: ' ', [LINE.ADDED]: '+', [LINE.REMOVED]: '−' };

/** One side of a card: the part's text, a line per row, keeping blank lines. */
const Lines = ({ lines, label }) => (
  <div className="min-w-0 overflow-hidden rounded-(--radius-sm) border border-border">
    {label && (
      <p className="mono border-b border-border bg-surface-2 px-3 py-1.5 text-[10.5px] font-medium tracking-[0.06em] text-muted uppercase">
        {label}
      </p>
    )}
    <div className="mono overflow-x-auto py-1 text-[12px] leading-[1.6]">
      {lines.length === 0 && <p className="px-3 py-1 text-muted-2 italic">Nothing to show</p>}
      {lines.map((line, index) => (line.kind === 'gap' ? (
        // eslint-disable-next-line react/no-array-index-key
        <p key={index} className="px-3 py-0.5 text-[11px] text-muted-2 select-none">
          ⋯ {line.count} unchanged line{line.count === 1 ? '' : 's'}
        </p>
      ) : (
        // eslint-disable-next-line react/no-array-index-key
        <p key={index} className={cn('flex gap-2 px-3 whitespace-pre-wrap break-words', LINE_CLASS[line.kind])}>
          <span aria-hidden="true" className="w-2.5 shrink-0 select-none opacity-70">{MARK[line.kind]}</span>
          <span className="sr-only">{line.kind === LINE.CONTEXT ? '' : `${line.kind}: `}</span>
          <span className={cn('min-w-0 flex-1', line.kind === LINE.REMOVED && line.text && STRIKE)}>{line.text || ' '}</span>
        </p>
      )))}
    </div>
  </div>
);

const TYPE_BADGE = {
  changed: { tone: 'working', label: 'Changed' },
  added: { tone: 'ready', label: 'New section' },
  removed: { tone: 'failed', label: 'Removed' },
};

/**
 * One entry of `changes[]`: a changed part shows Before | After with
 * line highlighting (stacked on narrow screens); an added part only its new
 * text, all green; a removed part only its old text, all red.
 */
const ChangeCard = memo(({ change, changedOnly }) => {
  const { type, section, before, after } = change;

  const view = useMemo(() => {
    if (type === 'changed') {
      const diff = diffLines(before?.text, after?.text);
      return { ...diff, summary: lineSummary(diff) };
    }
    if (type === 'added') {
      const lines = markAll(after?.text, LINE.ADDED);
      return { after: lines, summary: `${lines.length} line${lines.length === 1 ? '' : 's'}` };
    }
    const lines = markAll(before?.text, LINE.REMOVED);
    return { before: lines, summary: `${lines.length} line${lines.length === 1 ? '' : 's'}` };
  }, [type, before?.text, after?.text]);

  const badge = TYPE_BADGE[type] ?? { tone: 'idle', label: type ?? 'Unknown' };
  const pages = pagesText(before?.pages ?? [], after?.pages ?? []);
  const show = (lines) => (changedOnly && type === 'changed' ? onlyChanged(lines) : lines);

  return (
    <article className="rounded-(--radius) border border-border bg-surface p-4 shadow-(--sh-sm)">
      <header className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="min-w-0 flex-1 basis-60 font-display text-[14px] font-semibold break-words text-ink">
          {section || 'Untitled section'}
        </h2>
        <Badge tone={badge.tone}>{badge.label}</Badge>
        {pages && <span className="mono text-[11px] text-muted">{pages}</span>}
        <span className="text-[12px] text-muted">· {view.summary}</span>
      </header>

      {type === 'changed' ? (
        <div className="grid gap-3 md:grid-cols-2">
          <Lines lines={show(view.before)} label="Before" />
          <Lines lines={show(view.after)} label="After" />
        </div>
      ) : (
        <Lines lines={view.after ?? view.before} />
      )}
    </article>
  );
});
ChangeCard.displayName = 'ChangeCard';

export default ChangeCard;
