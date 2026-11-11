import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { formatDuration } from '../../utils/format';

/**
 * How long one question took, from the moment it was asked: ticking while the
 * answer streams, then fixed at "Answered in 12.4s". Answers loaded from
 * history have no finish time, so they show nothing.
 */
const AnswerTimer = ({ startedAt, finishedAt, streaming, stopped }) => {
  const start = Date.parse(startedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!streaming) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(timer);
  }, [streaming]);

  if (!Number.isFinite(start)) return null;
  if (!streaming && !Number.isFinite(finishedAt)) return null;

  const text = formatDuration((streaming ? now : finishedAt) - start);
  if (!text) return null;

  return (
    <p className="mono mt-1 flex items-center gap-1 px-1 text-[11px] text-muted" aria-live="off">
      <Timer className="h-3 w-3" aria-hidden="true" />
      {streaming ? text : `${stopped ? 'Stopped after' : 'Answered in'} ${text}`}
    </p>
  );
};

export default AnswerTimer;
