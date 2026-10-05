import { memo } from 'react';
import { FileText, Layers } from 'lucide-react';
import cn from '../../utils/cn';
import Skeleton from '../feedback/Skeleton';
import { MESSAGES } from '../../constants/messages';
import { DOCUMENT_STATUS, SUMMARY_STATUS } from '../../constants/documentStatus';

const statusLabel = (doc) => {
  if (doc.status === DOCUMENT_STATUS.PROCESSING) return 'Indexing';
  if (doc.status === DOCUMENT_STATUS.FAILED) return 'Processing failed';
  if (doc.summaryStatus === SUMMARY_STATUS.FAILED) return 'Summary failed';
  if (doc.summaryStatus === SUMMARY_STATUS.PENDING || doc.summaryStatus === SUMMARY_STATUS.PROCESSING) {
    return 'Summary processing';
  }
  return null;
};

const itemClass = (active) =>
  cn(
    'flex w-full items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-2 text-left text-[13px] transition-colors',
    active ? 'bg-navy-3 font-medium text-white' : 'text-ink-2 hover:bg-surface-2'
  );

/**
 * Memoised so typing in the composer doesn't re-render the whole list (§13).
 */
const DocumentRow = memo(({ document: doc, active, onSelect }) => (
  <button type="button" onClick={() => onSelect(doc.id)} className={itemClass(active)} title={doc.filename}>
    <FileText className="h-4 w-4 shrink-0" />
    <span className="min-w-0 flex-1">
      <span className="block truncate">{doc.filename}</span>
      {statusLabel(doc) && <span className="block text-[10px] opacity-75">{statusLabel(doc)}</span>}
    </span>
  </button>
));
DocumentRow.displayName = 'DocumentRow';

const DocumentList = ({ documents, activeId, loading, onSelect }) => (
  <div className="space-y-1">
    <button type="button" onClick={() => onSelect(null)} className={itemClass(activeId === null)}>
      <Layers className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{MESSAGES.ALL_DOCUMENTS}</span>
    </button>

    {loading && documents.length === 0
      ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-9 w-full" />)
      : documents.map((doc) => (
          <DocumentRow
            key={doc.id}
            document={doc}
            active={doc.id === activeId}
            onSelect={onSelect}
          />
        ))}

    {!loading && documents.length === 0 && (
      <p className="px-2.5 py-3 text-[12px] text-muted">
        No documents yet — upload one to give the assistant something to read.
      </p>
    )}
  </div>
);

export default DocumentList;
