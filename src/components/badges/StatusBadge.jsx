import cn from '../../utils/cn';
import { DOCUMENT_STATUS, SUMMARY_STATUS } from '../../constants/documentStatus';

const TONES = {
  ready: 'bg-green-bg text-green',
  working: 'bg-blue-lt text-blue-dk',
  failed: 'bg-red-bg text-red',
  idle: 'bg-chip text-muted',
};

/** Small mono pill (§3.3). `tone` is one of TONES. */
export const Badge = ({ tone = 'idle', children, className }) => (
  <span className={cn('mono inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium', TONES[tone], className)}>
    {children}
  </span>
);

const DOCUMENT_BADGE = {
  [DOCUMENT_STATUS.COMPLETED]: { tone: 'ready', label: 'Ready' },
  [DOCUMENT_STATUS.PROCESSING]: { tone: 'working', label: 'Indexing' },
  [DOCUMENT_STATUS.FAILED]: { tone: 'failed', label: 'Failed' },
};

const SUMMARY_BADGE = {
  [SUMMARY_STATUS.COMPLETED]: { tone: 'ready', label: 'Ready' },
  [SUMMARY_STATUS.PROCESSING]: { tone: 'working', label: 'Writing' },
  [SUMMARY_STATUS.PENDING]: { tone: 'idle', label: 'Pending' },
  [SUMMARY_STATUS.FAILED]: { tone: 'failed', label: 'Failed' },
};

export const DocumentStatusBadge = ({ status }) => {
  const badge = DOCUMENT_BADGE[status] ?? { tone: 'idle', label: status ?? 'Unknown' };
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
};

export const SummaryStatusBadge = ({ status }) => {
  const badge = SUMMARY_BADGE[status] ?? { tone: 'idle', label: status ?? '—' };
  return <Badge tone={badge.tone}>{badge.label}</Badge>;
};
