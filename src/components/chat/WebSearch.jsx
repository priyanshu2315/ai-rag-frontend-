import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, ChevronDown, FileText, Globe, Info, Loader2, RotateCw, Search, X } from 'lucide-react';
import Button from '../buttons/Button';
import cn from '../../utils/cn';
import { formatDate } from '../../utils/format';
import { agentLabel, isWebUrl } from '../../utils/webSearch';

const DEFAULT_MESSAGE = 'I need your approval to search the web before I answer.';

/** A web page link: opens in a new tab and never passes this app as the referrer. */
const WebLink = ({ url, className, children }) => (isWebUrl(url) ? (
  <a href={url} target="_blank" rel="noopener noreferrer" title={url} className={cn('break-all text-blue hover:underline', className)}>
    {children ?? url}
  </a>
) : <span className="break-all">{url}</span>);

/** "Web" beside a planned task that is answered from the web, not the documents. */
export const WebBadge = () => (
  <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-blue-lt px-1.5 align-middle text-[10px] leading-4 font-medium text-blue-dk">
    <Globe className="h-2.5 w-2.5" aria-hidden="true" />Web
  </span>
);

/**
 * In place of the answer while a run waits for the user: what would be
 * searched, and Allow / Skip. Both buttons go off once one is clicked, and stay
 * off while another answer in this chat is still streaming (`busy`).
 * "resuming" (saved by another tab, or a lost connection) only offers Reload.
 */
export const WebApprovalCard = ({ approval, busy = false, onResume, onReload }) => {
  if (approval.status === 'resuming') {
    return (
      <div role="status" className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue" aria-hidden="true" />
        <span className="flex-1">Answering…</span>
        {onReload && (
          <Button variant="secondary" size="sm" onClick={onReload}>
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Reload
          </Button>
        )}
      </div>
    );
  }

  const locked = approval.pending || busy || !onResume;
  return (
    <section aria-label="Web search approval" className="rounded-(--radius-sm) border border-blue/30 bg-blue-lt/40 p-3">
      <p className="flex items-start gap-2 font-medium text-ink">
        <Globe className="mt-0.5 h-4 w-4 shrink-0 text-blue" aria-hidden="true" />
        <span className="min-w-0 break-words">{approval.message || DEFAULT_MESSAGE}</span>
      </p>
      {approval.webHops.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">What will be searched</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink-2">
            {approval.webHops.map((hop, index) => <li key={hop.id ?? index} className="break-words">{hop.task}</li>)}
          </ul>
        </div>
      )}
      <p className="mt-2.5 text-[12px] text-muted">Values found in your documents (for example an amount) may be included in the web search.</p>
      {approval.error && <p role="alert" className="mt-2 break-words text-[12px] text-red">{approval.error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => onResume(true)} disabled={locked} loading={approval.pending && approval.choice === true}>
          {!(approval.pending && approval.choice === true) && <Globe className="h-3.5 w-3.5" aria-hidden="true" />} Allow web search
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onResume(false)} disabled={locked} loading={approval.pending && approval.choice === false}>
          Skip
        </Button>
        {busy && !approval.pending && <span className="text-[11px] text-muted">Wait for the current answer to finish.</span>}
      </div>
    </section>
  );
};

const FOCUSABLE = 'a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])';
const LEAVE_MS = 180;

/**
 * The same question as the card, as a popup: opened only when the run pauses
 * while its chat is on screen in a visible tab. Allow / Skip play the exit
 * animation, then send the choice. The ✕, Escape or the backdrop only close
 * it, with no API call: the inline card stays in the chat.
 */
export const WebApprovalDialog = ({ approval, busy = false, onResume, onClose }) => {
  const [leaving, setLeaving] = useState(null); // 'allow' | 'skip' | 'later'
  const panelRef = useRef(null);
  const allowRef = useRef(null);
  const titleId = useId();
  const textId = useId();
  const leaveRef = useRef(null);

  const leave = (choice) => {
    if (leaving) return;
    setLeaving(choice);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      if (choice !== 'later') onResume(choice === 'allow');
      onClose();
    }, reduced ? 0 : LEAVE_MS);
  };
  useEffect(() => { leaveRef.current = leave; });

  useEffect(() => {
    const previousFocus = document.activeElement;
    allowRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { leaveRef.current('later'); return; }
      if (event.key !== 'Tab') return;
      const items = [...panelRef.current.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  if (typeof document === 'undefined') return null;
  const locked = busy || Boolean(leaving);

  return createPortal(
    <div role="presentation" data-leaving={leaving ? '' : undefined} onClick={() => leave('later')}
      className="wa-backdrop fixed inset-0 z-50 flex items-end justify-center bg-scrim/45 p-3 backdrop-blur-[3px] sm:items-center sm:p-4">
      <div ref={panelRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={textId}
        onClick={(event) => event.stopPropagation()}
        className="wa-panel relative max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-(--radius-lg) border border-border bg-surface shadow-(--sh-lg)">
        <div className="wa-sheen" aria-hidden="true" />
        <button type="button" onClick={() => leave('later')} aria-label="Close"
          className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-(--radius-sm) text-muted hover:bg-chip hover:text-ink">
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col items-center px-6 pt-7 text-center">
          <span className="relative grid h-14 w-14 place-items-center rounded-full bg-blue-lt text-blue" aria-hidden="true">
            <span className="wa-ring" />
            <span className="wa-ring" />
            <Globe className="wa-sway relative h-7 w-7" />
          </span>
          <h2 id={titleId} className="mt-4 text-[16px] font-semibold text-ink">Search the web?</h2>
          <p id={textId} className="mt-1 text-[13px] text-muted">{approval.message || DEFAULT_MESSAGE}</p>
        </div>

        <div className="px-6 pt-4">
          {approval.webHops.length > 0 && (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">What will be searched</p>
              <ul className="mt-1.5 space-y-1.5">
                {approval.webHops.map((hop, index) => (
                  <li key={hop.id ?? index} className="wa-item flex items-start gap-2 rounded-(--radius-sm) border border-border bg-surface-2 px-2.5 py-2 text-[13px] text-ink-2"
                    style={{ animationDelay: `${160 + index * 70}ms` }}>
                    <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue" aria-hidden="true" />
                    <span className="min-w-0 break-words">{hop.task}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="wa-item mt-3 flex items-start gap-2 rounded-(--radius-sm) bg-amber/10 px-2.5 py-2 text-[12px] text-ink-2"
            style={{ animationDelay: `${200 + approval.webHops.length * 70}ms` }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" aria-hidden="true" />
            Values found in your documents (for example an amount) may be included in the web search.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 px-6 pt-5 pb-5 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => leave('skip')} disabled={locked} loading={leaving === 'skip'}>Skip</Button>
          <Button ref={allowRef} onClick={() => leave('allow')} disabled={locked} loading={leaving === 'allow'}>
            {leaving !== 'allow' && <Globe className="h-4 w-4" aria-hidden="true" />} Allow web search
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/**
 * Under the answer: the pages the web facts came from and when they were
 * searched — or that the search failed, or was skipped, so the reader knows
 * the answer rests on the documents alone.
 */
export const WebSources = ({ facts, approved, fallbackDate }) => {
  if (approved === false) {
    return <p className="mt-3 text-[11px] text-muted">Web search skipped; the answer uses your documents only.</p>;
  }
  if (!facts) return null;
  const searchedAt = facts.searchedAt ?? (Number.isFinite(fallbackDate) ? new Date(fallbackDate).toISOString() : null);
  const failures = facts.failures.length > 0 && (
    <ul className="mt-1 space-y-0.5">
      {facts.failures.map((task, index) => (
        <li key={`${task}-${index}`} className="flex items-start gap-1.5 text-[12px] text-amber">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{task ? `Web search failed for: ${task}` : 'Web search failed; answer uses documents only'}</span>
        </li>
      ))}
    </ul>
  );
  // Nothing found at all: only the failures are worth saying.
  if (facts.sources.length === 0) return failures ? <div className="mt-3">{failures}</div> : null;
  return (
    <div className="mt-3 border-t border-border pt-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-2">
        <Globe className="h-3 w-3" aria-hidden="true" /> Web sources
      </p>
      {failures}
      {facts.sources.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[12px]">
          {facts.sources.map((url) => (
            <li key={url} className="min-w-0 truncate">
              <WebLink url={url} className="break-normal">{url.replace(/^https?:\/\/(www\.)?/i, '')}</WebLink>
            </li>
          ))}
        </ul>
      )}
      {searchedAt && <p className="mt-1 text-[11px] text-muted">Searched on {formatDate(searchedAt)}</p>}
    </div>
  );
};

/** Steps panel: the question to the user, and their answer. */
export const WebApprovalSteps = ({ web, streaming }) => (
  <div className="space-y-1">
    <p className="flex items-center gap-1.5 text-ink-2">
      <Globe className="h-3.5 w-3.5 shrink-0 text-blue" aria-hidden="true" /> Asked to search the web
    </p>
    {web.asked.hops.length > 0 && (
      <ul className="ml-5 list-disc space-y-0.5 text-[11px] text-muted">
        {web.asked.hops.map((hop, index) => <li key={hop.id ?? index} className="break-words">{hop.task}</li>)}
      </ul>
    )}
    {web.approved === true && (
      <p className="flex items-center gap-1.5 text-green"><Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> User allowed web search</p>
    )}
    {web.approved === false && (
      <p className="flex items-center gap-1.5 text-muted"><X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> User skipped web search</p>
    )}
    {web.approved === null && <p className="text-[11px] text-amber">{streaming ? 'Continuing…' : 'Waiting for your answer'}</p>}
  </div>
);

const WebCall = ({ call }) => (
  <li className={cn('flex min-w-0 items-start gap-1.5 text-[12px]', !call.ok && 'text-muted-2 opacity-70')}>
    {call.tool === 'read_page'
      ? <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
      : <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />}
    <span className="min-w-0 flex-1 break-words">
      {call.tool === 'read_page' && <>Read {call.url ? <WebLink url={call.url} className={cn(!call.ok && 'text-muted-2')} /> : 'a page'}</>}
      {call.tool === 'web_search' && <>Searched “{call.query ?? '…'}”</>}
      {!['read_page', 'web_search'].includes(call.tool) && call.tool}
      {!call.ok && <span className="ml-1 text-[11px]">· failed</span>}
    </span>
    {call.step != null && <span className="mono shrink-0 text-[10px] text-muted-2">step {call.step}</span>}
  </li>
);

const WebResult = ({ finish }) => {
  if (finish.failed) {
    return (
      <p className="break-words text-[12px] text-amber">
        This search failed{finish.reason ? `: ${finish.reason}` : ''}. The answer goes on without it.
      </p>
    );
  }
  return (
    <div className="rounded-(--radius-sm) border border-border bg-surface-2 p-2">
      <p className="text-[11px] font-medium text-muted">Result</p>
      <p className="break-words whitespace-pre-wrap text-[12px] text-ink">{finish.answer || 'No result recorded.'}</p>
      {finish.stopReason === 'step_limit' && (
        <p className="mt-1 text-[11px] text-amber">Stopped at the step limit and answered with what it found.</p>
      )}
      {finish.sources.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer text-[11px] text-blue">Pages looked at · {finish.sources.length}</summary>
          <ul className="mt-1 space-y-0.5 text-[11px]">
            {finish.sources.map((url) => <li key={url}><WebLink url={url} /></li>)}
          </ul>
        </details>
      )}
    </div>
  );
};

/** Steps panel: one agent's calls, then what it found. */
export const WebResearch = ({ agent }) => {
  if (!agent) return <span className="text-muted">Searching the web…</span>;
  return (
    <div className="space-y-1.5">
      {agent.calls.length > 0
        ? <ol className="space-y-1">{agent.calls.map((call, index) => <WebCall key={index} call={call} />)}</ol>
        : !agent.finish && <p className="text-muted">Searching the web…</p>}
      {agent.finish && <WebResult finish={agent.finish} />}
    </div>
  );
};

const AgentMark = ({ agent }) => {
  if (agent.running) return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-sb-accent" aria-label="Working" />;
  if (agent.finish?.failed) return <X className="h-3.5 w-3.5 shrink-0 text-red-300" aria-label="Failed" />;
  return <Check className="h-3.5 w-3.5 shrink-0 text-green-400" aria-label="Finished" />;
};

/**
 * Below the chat input while the answer streams: "● 3 agents working", and on
 * click one line per agent — its task and its latest step, or how it ended.
 * Live only; a reloaded answer shows its agents in the steps panel instead.
 */
export const RunningAgents = ({ agents }) => {
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!agents?.length) return null;
  const running = agents.filter((agent) => agent.running).length;
  const noun = (count) => `${count} ${count === 1 ? 'agent' : 'agents'}`;
  const label = running > 0 ? `${noun(running)} working` : `${noun(agents.length)} finished`;
  return (
    // In the input row, left of the box — the counterpart of the lock and
    // stop buttons on the right. The list opens upward, over the chat.
    <div className="wa-item relative mb-0.5 shrink-0 text-[12px]">
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls={listId}
        aria-label={label} title={label}
        className="inline-flex h-9 items-center gap-1.5 rounded-(--radius-sm) border border-sb-border bg-sb px-2.5 font-medium text-white transition-colors hover:bg-sb-raised">
        {running > 0 ? (
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-70 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
        ) : <Check className="h-3 w-3 text-sb-accent" aria-hidden="true" />}
        {/* Phones get the number alone, so the input keeps its room. */}
        <span aria-live="polite">
          <span className="sm:hidden">{running > 0 ? running : agents.length}</span>
          <span className="hidden sm:inline">{label}</span>
        </span>
        <ChevronDown className={cn('h-3 w-3 text-sb-accent transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <ul id={listId} className="absolute bottom-full left-0 z-20 mb-2 max-h-64 w-[min(24rem,calc(100vw-1.5rem))] space-y-1 overflow-y-auto rounded-(--radius-sm) border border-sb-border bg-sb p-2 text-sb-text shadow-(--sh-lg)">
          {agents.map((agent) => (
            <li key={agent.id} className="flex min-w-0 items-start gap-2">
              <span className="mt-0.5"><AgentMark agent={agent} /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-white" title={agent.task ?? undefined}>{agent.task ?? 'Web research'}</span>
                <span className={cn('block truncate text-[11px]', agent.finish?.failed ? 'text-red-300' : 'text-sb-label')}>
                  {agent.running ? agentLabel(agent) : agent.finish?.failed ? `Failed${agent.finish.reason ? `: ${agent.finish.reason}` : ''}` : 'Done'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
