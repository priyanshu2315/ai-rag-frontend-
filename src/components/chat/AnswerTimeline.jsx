import { memo, useState } from 'react';
import { Check, ChevronRight, Loader2, Search } from 'lucide-react';
import cn from '../../utils/cn';

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
        {step.done && step.kind === 'tool' && <Search className="h-2 w-2" />}
        {step.done && step.kind !== 'tool' && <Check className="h-2.5 w-2.5" />}
      </span>

      {/* The rail needs the row to be taller than the dot to show at all —
          hence the padding below, which is what gives it its length. */}
      {!isLast && <span className="mt-1 w-0 flex-1 border-l-2 border-dotted border-border-2" />}
    </div>

    <div className={cn('min-w-0', isLast ? 'pb-0' : 'pb-3.5')}>
      <p className={cn('text-[12px] leading-snug', step.done ? 'text-ink-2' : 'font-medium text-ink')}>
        {step.label}
      </p>

      {step.query && (
        <p className="mono mt-0.5 break-words text-[11px] leading-snug text-muted">“{step.query}”</p>
      )}

      {step.detail && (
        <p className="mt-0.5 break-words text-[11px] leading-snug text-muted">{step.detail}</p>
      )}
    </div>
  </li>
);

/**
 * How the agent got to an answer: every status transition and tool call it
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
  const open = choice ?? streaming;

  return (
    <div className={cn(separated && 'mb-3 border-b border-border pb-3')}>
      <button
        type="button"
        onClick={() => setChoice(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2 transition-colors hover:text-muted"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', open && 'rotate-90')} />
        {streaming ? 'Working' : `How this was answered · ${steps.length} steps`}
      </button>

      {open && (
        <ol className="mt-2.5">
          {steps.map((step, index) => (
            <StepNode key={step.id} step={step} isLast={index === steps.length - 1} />
          ))}
        </ol>
      )}
    </div>
  );
});

AnswerTimeline.displayName = 'AnswerTimeline';

export default AnswerTimeline;
