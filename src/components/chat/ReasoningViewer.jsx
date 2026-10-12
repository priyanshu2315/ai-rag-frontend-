import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Brain, X } from 'lucide-react';
import AnswerTimeline from './AnswerTimeline';
import { readableTraceText, traceChunkLabels } from '../../utils/traceChunks';

const STEP_TYPES = {
  initial_search: ['🔍', 'Search Retrieval'], neighbor_expansion: ['📖', 'Context Expansion'],
  reference_following: ['🔗', 'Cross-Reference Resolution'], multi_hop_search: ['🔄', 'Multi-Hop Follow-up'],
  synthesis: ['🧠', 'Answer Grounding'],
};

export const ReasoningContent = ({ chain, steps = [], streaming, onReferenceSelect }) => {
  const labels = traceChunkLabels(steps);
  return <div className="space-y-4">
    {chain?.summary && <div className="rounded-(--radius-sm) border border-blue/30 bg-blue-lt p-4 text-sm text-ink-2">
      <p className="mb-1 text-[11px] font-semibold uppercase text-blue">Summary overview</p>
      <p className="whitespace-pre-wrap break-words">{readableTraceText(chain.summary, labels)}</p>
    </div>}
    {chain?.steps?.length > 0 && <ol className="space-y-4" aria-label="Reasoning chain steps">{chain.steps.map((step, index) => {
      const [icon, label] = STEP_TYPES[step.type] ?? ['⚡', step.type];
      return <li key={`${step.step}-${index}`} className="flex gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2" aria-hidden="true">{icon}</span>
        <div className="min-w-0 flex-1 rounded-(--radius-sm) border border-border bg-surface p-3">
          <div className="mb-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted"><span className="rounded-full bg-surface-2 px-2 py-0.5">{label}</span><span>Step {step.step ?? index + 1}</span></div>
          <h3 className="font-semibold text-ink">{readableTraceText(step.title, labels)}</h3>
          {step.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted">{readableTraceText(step.description, labels)}</p>}
          {step.findings && <div className="mt-3 rounded-(--radius-sm) border-l-2 border-blue bg-surface-2 p-3 text-sm text-ink-2">
            <strong className="mb-1 block">Findings:</strong>
            <div className="findings-content whitespace-pre-line break-words leading-[1.6]">
              {readableTraceText(step.findings, labels).split(/\r?\n/).map((line, lineIndex) => {
                const isTrigger = /Trigger for next step:/i.test(line);
                return <div key={lineIndex} className={isTrigger
                  ? 'finding-trigger-highlight mt-1.5 rounded border-l-2 border-violet-500 bg-violet-50 px-2 py-1 font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-200'
                  : 'finding-bullet min-h-[1.6em]'}>
                  {isTrigger ? `↳ ${line.replace(/^\s*•\s*/, '').trim()}` : line}
                </div>;
              })}
            </div>
          </div>}
        </div>
      </li>;
    })}</ol>}
    {steps.length > 0 && (chain ? <details><summary className="cursor-pointer text-sm font-medium text-blue">Detailed retrieval trace</summary><div className="mt-3"><AnswerTimeline steps={steps} streaming={streaming} onReferenceSelect={onReferenceSelect} /></div></details>
      : <AnswerTimeline steps={steps} streaming={streaming} onReferenceSelect={onReferenceSelect} />)}
  </div>;
};

const ReasoningModal = ({ onClose, ...contentProps }) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);
  return createPortal(<dialog ref={dialogRef} aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === dialogRef.current) onClose(); }}
    className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-hidden rounded-(--radius) border border-border bg-surface p-0 text-ink shadow-(--sh-lg) backdrop:bg-scrim/50">
    <div className="flex max-h-[85dvh] flex-col" onClick={(event) => event.stopPropagation()}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div><h2 id={titleId} className="font-display text-lg font-semibold">Reasoning & retrieval chain</h2><p id={descriptionId} className="mt-1 text-[12px] text-muted">How evidence was gathered and used for this answer.</p></div>
        <button type="button" autoFocus onClick={onClose} aria-label="Close reasoning" className="rounded p-2 hover:bg-surface-2"><X className="h-4 w-4" /></button>
      </header>
      <div className="min-h-0 overflow-y-auto p-4 sm:p-5"><ReasoningContent {...contentProps} /></div>
      <footer className="flex shrink-0 justify-end border-t border-border p-3"><button type="button" onClick={onClose} className="rounded-(--radius-sm) bg-blue-lt px-4 py-2 text-sm font-medium text-blue hover:bg-surface-2">Close</button></footer>
    </div>
  </dialog>, document.body);
};

const ReasoningViewer = ({ chain, steps = [], streaming, onReferenceSelect }) => {
  const [open, setOpen] = useState(false);
  if (!chain && !steps.length) return null;
  return <div className="mb-2">
    <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
      className="inline-flex items-center gap-1.5 rounded-full border border-blue/30 bg-blue-lt px-3 py-1.5 text-[12px] font-medium text-blue hover:bg-surface-2">
      <Brain className="h-3.5 w-3.5" aria-hidden="true" />{chain ? 'Reasoning Chain' : 'Reasoning Trace'}{streaming ? ' · Working' : ` · ${chain?.steps.length ?? steps.filter((step) => step.kind !== 'token').length} steps`}
    </button>
    {open && <ReasoningModal chain={chain} steps={steps} streaming={streaming} onClose={() => setOpen(false)} onReferenceSelect={(link) => { onReferenceSelect?.(link); setOpen(false); }} />}
  </div>;
};
export default ReasoningViewer;
