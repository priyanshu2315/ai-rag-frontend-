import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import cn from '../../utils/cn';
import ChunkId from './ChunkId';
import CopyButton from '../buttons/CopyButton';
import Markdown from '../chat/Markdown';
import { readableChunkText, textStats } from '../../utils/chunkText';

const VIEWS = [['clean', 'Clean'], ['raw', 'Raw']];

// The last view picked, so a reader comparing raw text across chunks is not
// flipped back to Clean on every open. Session only, like the rest of the trace.
let lastView = 'clean';

/**
 * Everything known about one chunk, at reading size. `meta` is label/value
 * pairs from whichever list opened it — the steps card and the Search
 * Inspector know different things about the same chunk.
 */
export const ChunkViewerContent = ({ chunk, view, onView }) => {
  const text = typeof chunk.text === 'string' ? chunk.text : '';
  const clean = useMemo(() => (view === 'clean' ? readableChunkText(text) : ''), [text, view]);
  const stats = textStats(text);
  const searchText = typeof chunk.searchText === 'string' && chunk.searchText && chunk.searchText !== text ? chunk.searchText : null;
  const meta = (chunk.meta ?? []).filter(([, value]) => value != null && value !== '');

  return (
    <div className="space-y-4">
      {meta.length > 0 && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
          {meta.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0 break-words text-ink-2">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div role="group" aria-label="Text view" className="inline-flex rounded-(--radius-sm) border border-border-2 p-0.5">
            {VIEWS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={view === id} onClick={() => onView(id)}
                className={cn('rounded-[4px] px-2.5 py-1 text-[12px] font-medium transition-colors',
                  view === id ? 'bg-blue-lt text-blue' : 'text-muted hover:text-ink')}>
                {label}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-3 text-[11px] text-muted-2">
            <span>{stats.words.toLocaleString()} words · {stats.characters.toLocaleString()} characters</span>
            {text && <CopyButton text={view === 'raw' ? text : clean} label={view === 'raw' ? 'Copy raw text' : 'Copy text'} />}
          </span>
        </div>

        {!text ? (
          <p className="mt-3 text-[13px] text-muted">No text was recorded for this chunk.</p>
        ) : view === 'clean' ? (
          <div className="mt-3 max-w-[70ch] break-words text-[14px] text-ink-2">
            <Markdown>{clean}</Markdown>
          </div>
        ) : (
          <pre className="mono mt-3 whitespace-pre-wrap break-words rounded-(--radius-sm) border border-border bg-surface-2 p-3 text-[12px] leading-relaxed text-ink-2">{text}</pre>
        )}
      </div>

      {view === 'raw' && searchText && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">Search text</p>
          <p className="mt-0.5 text-[11px] text-muted">What the keyword and vector indexes saw, when it differs from the text.</p>
          <pre className="mono mt-2 whitespace-pre-wrap break-words rounded-(--radius-sm) border border-border bg-surface-2 p-3 text-[12px] leading-relaxed text-ink-2">{searchText}</pre>
        </div>
      )}
    </div>
  );
};

const ChunkViewerModal = ({ chunk, onClose }) => {
  const dialogRef = useRef(null);
  const titleId = useId();
  const [view, setView] = useState(lastView);
  const pickView = (next) => { lastView = next; setView(next); };

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    // A native modal dialog stacks in the top layer, so this opens cleanly
    // over the Search Inspector, which is a dialog itself.
    dialog.showModal();
    return () => { dialog.close(); if (previousFocus?.isConnected) previousFocus.focus(); };
  }, []);

  return createPortal(
    // Portaled, but React still bubbles events up the component tree: stop them
    // here so a click inside never reaches the row (or summary) that opened it.
    <dialog ref={dialogRef} aria-modal="true" aria-labelledby={titleId}
      // React passes `cancel` up the component tree too, so without the stop an
      // Escape here would also close the Search Inspector this opened over.
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onClick={(event) => { event.stopPropagation(); if (event.target === dialogRef.current) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-hidden rounded-(--radius) border border-border bg-surface p-0 text-ink shadow-(--sh-lg) backdrop:bg-scrim/50">
      <div className="flex max-h-[90dvh] flex-col" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-base font-semibold">
              Chunk{chunk.page != null && <span className="font-normal text-muted"> · page {chunk.page}</span>}
            </h2>
            {chunk.documentTitle && <p className="mt-0.5 break-words text-[12px] text-muted">{chunk.documentTitle}</p>}
            {chunk.heading && <p className="mt-0.5 break-words text-[12px] text-muted">{chunk.heading}</p>}
            <ChunkId id={chunk.id} className="mt-1.5" />
          </div>
          <button type="button" autoFocus onClick={onClose} aria-label="Close chunk viewer" className="shrink-0 rounded p-2 hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5">
          <ChunkViewerContent chunk={chunk} view={view} onView={pickView} />
        </div>
      </div>
    </dialog>,
    document.body
  );
};

/**
 * The "View" link a chunk row carries. It often sits inside a `<summary>` or a
 * toggle row, so the click stops here rather than also opening that row.
 */
const ChunkViewButton = ({ chunk, className }) => {
  const [open, setOpen] = useState(false);
  if (!chunk || chunk.id == null) return null;
  return (
    <>
      <button type="button" aria-haspopup="dialog" aria-label={`View chunk ${chunk.id}`} title="View chunk in detail"
        onClick={(event) => { event.preventDefault(); event.stopPropagation(); setOpen(true); }}
        className={cn('inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-blue hover:underline', className)}>
        <Maximize2 className="h-3 w-3" aria-hidden="true" />
        View
      </button>
      {open && <ChunkViewerModal chunk={chunk} onClose={() => setOpen(false)} />}
    </>
  );
};

export default ChunkViewButton;
