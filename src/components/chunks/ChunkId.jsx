import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import cn from '../../utils/cn';

/**
 * A chunk's id with a copy button, for every place a chunk is listed.
 *
 * Lists here are mostly `<details>` rows that toggle on click, so the copy
 * click stops where it lands — copying an id must not also open or close the
 * row it sits in.
 */
const ChunkId = ({ id, label = 'chunk ID', truncate = false, className }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!status) return undefined;
    const timer = setTimeout(() => setStatus(null), 1500);
    return () => clearTimeout(timer);
  }, [status]);

  if (id == null || id === '') return null;

  const copy = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(id));
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    // `relative` keeps the sr-only status anchored here; unanchored, it is
    // placed against the page and makes the whole app scroll.
    <span className={cn('relative inline-flex min-w-0 max-w-full items-center gap-1 text-[10px] text-muted-2', className)}>
      <span className={cn('mono min-w-0', truncate ? 'truncate' : 'break-all')} title={String(id)}>{id}</span>
      <button type="button" onClick={copy} aria-label={`Copy ${label}`} title={status === 'failed' ? 'Copy failed' : `Copy ${label}`}
        className={cn('shrink-0 rounded p-0.5 hover:bg-surface-2 hover:text-ink', status === 'copied' && 'text-green', status === 'failed' && 'text-red')}>
        {status === 'copied' ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
      </button>
      {status && <span role="status" className="sr-only">{status === 'copied' ? 'Copied' : 'Copy failed'}</span>}
    </span>
  );
};

export default ChunkId;
