import { memo } from 'react';
import { useState } from 'react';
import { ChevronRight, Maximize2 } from 'lucide-react';
import Modal from '../modals/Modal';
import cn from '../../utils/cn';

const STATUS = {
  resolved: { label: 'RESOLVED', className: 'bg-green-bg text-green' },
  pending: { label: 'PENDING', className: 'bg-amber/15 text-amber' },
};

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue';

const IdChip = ({ children }) => (
  <span className="mono rounded-full bg-surface-2 px-1.5 text-[10px] leading-4 text-muted">{children}</span>
);

/** Passage numbers are stable across the panel: position in the answer's context. */
const PassageBadge = ({ number }) => (
  <span
    title={number ? `Passage ${number}` : 'Passage not found'}
    className="mono inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 px-1 text-[10.5px] font-semibold text-ink-2"
  >
    {number ?? '?'}
  </span>
);

/** Plain text only: passage text is never parsed as markup. */
const Highlighted = ({ match, large }) => (
  <p className={cn(
    'overflow-y-auto overscroll-contain rounded-(--radius-sm) border border-border bg-surface-2 p-2 leading-relaxed break-words whitespace-pre-wrap text-muted',
    large ? 'max-h-[45dvh] text-[13px]' : 'max-h-[230px] text-[12px]'
  )}>
    {match.segments.map((segment, index) => segment.marked
      ? <mark key={index} className="rounded-[2px] bg-green-bg text-ink underline decoration-green decoration-1 underline-offset-2">{segment.text}</mark>
      : <span key={index}>{segment.text}</span>)}
  </p>
);

const Entry = ({ entry, large }) => {
  const { passage, quote, match } = entry;
  if (!passage) {
    return (
      <li className="flex gap-2">
        <PassageBadge number={null} />
        <blockquote className="min-w-0 flex-1 border-l-2 border-border pl-2 text-[12px] break-words whitespace-pre-wrap text-ink-2">{quote || 'No quote recorded.'}</blockquote>
      </li>
    );
  }
  const meta = [passage.title, passage.section, passage.page != null ? `Page ${passage.page}` : null].filter(Boolean);
  return (
    <li className="flex gap-2">
      <PassageBadge number={passage.number} />
      <div className="min-w-0 flex-1">
        {meta.length > 0 && <p className="mb-1 truncate text-[11px] text-muted" title={meta.join(' · ')}>{meta.join(' · ')}</p>}
        <Highlighted match={match} large={large} />
        <p className="mt-1 text-[11px] text-muted">
          <span className="text-green">Quoted as evidence</span> · {match.usedChars} of {passage.text.length} characters used
          {match.missingParts > 0 && (
            <span className="block text-amber">
              {match.missingParts} quoted {match.missingParts === 1 ? 'line' : 'lines'} not found word for word
            </span>
          )}
        </p>
      </div>
    </li>
  );
};

const StatusLabel = ({ status }) => (
  <span className={cn('shrink-0 rounded-full px-1.5 text-[10px] leading-4 font-semibold tracking-wide', STATUS[status].className)}>{STATUS[status].label}</span>
);

/** What a task shows once opened: the same in the card and in the larger view. */
const TaskBody = ({ task, passageCount, large = false }) => (
  <div className="space-y-2">
    {task.value && <p className={cn('break-words whitespace-pre-wrap text-ink', large ? 'text-[13.5px]' : 'text-[12px]')}>{task.value}</p>}
    {task.builtFrom.length > 0 && (
      <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted">
        Built from the results of {task.builtFrom.map((id) => <IdChip key={id}>{id}</IdChip>)}
      </p>
    )}
    {task.entries.length > 0 ? (
      <div>
        <p className="mb-1.5 text-[11px] font-semibold text-ink-2">Answered from {task.passagesUsed} of {passageCount} passages</p>
        <ul className="space-y-2.5">{task.entries.map((entry) => <Entry key={entry.key} entry={entry} large={large} />)}</ul>
      </div>
    ) : task.status === 'pending' && <p className="text-[11px] text-muted">No passage settled this task</p>}
  </div>
);

const TaskCard = ({ task, passageCount }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="relative">
      <details open className="group rounded-(--radius-sm) border border-border">
        <summary className={cn('flex cursor-pointer list-none items-start gap-1.5 py-1.5 pr-9 pl-2.5 text-[12px]', focusRing)}>
          <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-2 transition-transform group-open:rotate-90" aria-hidden="true" />
          <span className="mono shrink-0 text-[11px] font-semibold text-ink">{task.id}</span>
          <StatusLabel status={task.status} />
          <span className="min-w-0 flex-1 break-words text-ink-2">{task.task ?? 'Task description unavailable'}</span>
        </summary>
        <div className="border-t border-border px-2.5 py-2">
          <TaskBody task={task} passageCount={passageCount} />
        </div>
      </details>
      {/* Beside the summary, not in it: a button inside would also toggle the card. */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label={`Open ${task.id} in a larger view`}
        title="Open in a larger view"
        className={cn('absolute top-1 right-1 inline-flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-chip hover:text-ink', focusRing)}
      >
        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {expanded && (
        <Modal
          size="xl"
          title={<span className="flex flex-wrap items-center gap-2"><span className="mono">{task.id}</span><StatusLabel status={task.status} /></span>}
          description={task.task ?? undefined}
          onClose={() => setExpanded(false)}
        >
          <TaskBody task={task} passageCount={passageCount} large />
        </Modal>
      )}
    </li>
  );
};

/** The body of the "Tasks" step; `data` comes from `buildTaskEvidence`. */
const TaskEvidence = memo(({ data }) => (
  <div>
    <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted">
      <span className="font-medium text-ink-2">{data.resolved} of {data.tasks.length} tasks answered</span>
      {data.stopReason && <span>· {data.stopReason}</span>}
      {data.rounds != null && <span>· {data.rounds} {data.rounds === 1 ? 'round' : 'rounds'}</span>}
    </p>
    <ul className="mt-1.5 space-y-2">{data.tasks.map((task) => <TaskCard key={task.id} task={task} passageCount={data.passageCount} />)}</ul>
  </div>
));
TaskEvidence.displayName = 'TaskEvidence';

export default TaskEvidence;
