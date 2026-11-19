import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Eye, FileText, FileUp, Layers, MessageSquare, Trash2 } from 'lucide-react';
import { Badge, DocumentStatusBadge, SummaryStatusBadge } from '../badges/StatusBadge';
import { TableRowsSkeleton } from '../feedback/Skeletons';
import { canDeleteDocument, canReplaceDocument } from '../../constants/documentStatus';
import { REPLACE_PHASE_LABEL, versionLabel } from '../../utils/documentVersion';
import { chunksPath, documentPath } from '../../constants/routes';
import { formatDate } from '../../utils/format';
import cn from '../../utils/cn';

const iconLink = 'inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-chip hover:text-ink';

/** Memoised so a progress event on one document doesn't re-render every row (§13). */
const replaceTitle = (doc, replacing) => {
  if (replacing) return 'A new version is being processed';
  return canReplaceDocument(doc) ? `Replace ${doc.filename} with a new version` : 'Only a fully processed document can be replaced';
};

const DocumentRow = memo(({
  serial, document: doc, canDelete, canReplace, deleting, busy, replacing, onPreview, onDelete, onReplace,
}) => {
  const version = versionLabel(doc);
  return (
  <tr className="border-t border-border hover:bg-surface-2">
    <td className="mono w-px whitespace-nowrap px-3 py-2 text-right text-[12px] text-muted">{serial}</td>
    <td className="max-w-0 px-3 py-2">
      <Link to={documentPath(doc.id)} className="flex min-w-0 items-center gap-2.5 font-medium text-ink hover:text-blue" title={doc.filename}>
        <FileText className="h-4 w-4 shrink-0 text-muted" />
        <span className="truncate">{doc.filename}</span>
        {version && <span className="mono shrink-0 text-[11px] font-medium text-muted">{version}</span>}
      </Link>
    </td>
    <td className="whitespace-nowrap px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">
        <DocumentStatusBadge status={doc.status} />
        {/* The document stays Ready (chat answers from the old version) while
            the new one is processed, so the replace gets a badge of its own. */}
        {replacing && (
          <Badge tone="working" className="animate-pulse">
            <span title={REPLACE_PHASE_LABEL[replacing.phase]}>
              {replacing.version ? `v${replacing.version} processing` : 'New version processing'}
            </span>
          </Badge>
        )}
      </div>
    </td>
    <td className="hidden px-3 py-2 sm:table-cell"><SummaryStatusBadge status={doc.summaryStatus} /></td>
    <td className="mono hidden px-3 py-2 text-[12px] whitespace-nowrap text-muted md:table-cell">{formatDate(doc.createdAt)}</td>
    <td className="px-2 py-1">
      <div className="flex items-center justify-end gap-0.5">
        <button
          type="button"
          onClick={() => onPreview(doc.id)}
          disabled={!doc.fileUrl}
          className={cn(iconLink, 'disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted')}
          title={doc.fileUrl ? 'Preview file' : 'No file to preview'}
          aria-label={`Preview ${doc.filename}`}
        >
          <Eye className="h-4 w-4" />
        </button>
        {/* Below sm the name link already opens the chat; the duplicate icon
            would push Delete off a phone screen. */}
        <Link to={documentPath(doc.id)} className={cn(iconLink, 'hidden sm:inline-flex')} title="Chat with this document" aria-label={`Chat with ${doc.filename}`}>
          <MessageSquare className="h-4 w-4" />
        </Link>
        <Link to={chunksPath(doc.id)} className={iconLink} title="Inspect chunks" aria-label={`Inspect chunks of ${doc.filename}`}>
          <Layers className="h-4 w-4" />
        </Link>
        {canReplace && (
          <button
            type="button"
            onClick={() => onReplace(doc)}
            disabled={Boolean(replacing) || deleting || !canReplaceDocument(doc)}
            className={cn(iconLink, 'disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted')}
            title={replaceTitle(doc, replacing)}
            aria-label={`Replace ${doc.filename} with a new version`}
          >
            <FileUp className="h-4 w-4" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={() => onDelete(doc)}
            disabled={busy || Boolean(replacing) || !canDeleteDocument(doc)}
            className={cn(iconLink, 'hover:bg-red-bg hover:text-red disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted')}
            title={replacing ? 'Wait for the new version to finish processing'
              : canDeleteDocument(doc) ? `Delete ${doc.filename}` : 'Only completed or failed documents can be deleted'}
            aria-label={`Delete ${doc.filename}`}
          >
            <Trash2 className={cn('h-4 w-4', deleting && 'animate-pulse')} />
          </button>
        )}
      </div>
    </td>
  </tr>
  );
});
DocumentRow.displayName = 'DocumentRow';

const HEAD = 'mono whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted';

/**
 * The knowledge-base listing (§6 `<DataTable>` shape, presentational only).
 * Delete and Replace appear only when `canDelete` / `canReplace` — the caller
 * decides that from the account's permissions. `replacing` maps a document id
 * to its running replace, if any. `onPreview` gets the document id; Preview is
 * disabled for a document with no `fileUrl`.
 */
const DocumentTable = ({
  documents, loading, canDelete, canReplace, deletingId, replacing = {}, onPreview, onDelete, onReplace,
}) => (
  <div className="overflow-x-auto rounded-(--radius) border border-border bg-surface">
    <table className="w-full border-collapse text-[13px]" aria-busy={loading && documents.length === 0}>
      <thead className="bg-bg">
        <tr>
          <th scope="col" className={cn(HEAD, 'text-right')}>S.No.</th>
          <th scope="col" className={cn(HEAD, 'w-full')}>Document</th>
          <th scope="col" className={HEAD}>Status</th>
          <th scope="col" className={cn(HEAD, 'hidden sm:table-cell')}>Summary</th>
          <th scope="col" className={cn(HEAD, 'hidden md:table-cell')}>Added</th>
          <th scope="col" className={cn(HEAD, 'text-right')}><span className="sr-only">Actions</span></th>
        </tr>
      </thead>
      <tbody>
        {loading && documents.length === 0
          ? (
              <TableRowsSkeleton
                actionCount={3 + (canDelete ? 1 : 0) + (canReplace ? 1 : 0)}
                columns={[
                  'num', 'icon', 'badge',
                  { type: 'badge', className: 'hidden sm:table-cell' },
                  { type: 'date', className: 'hidden md:table-cell' },
                  'actions',
                ]}
              />
            )
          // Numbered as shown, so a filtered list still reads 1, 2, 3…
          : documents.map((doc, index) => (
              <DocumentRow
                key={doc.id}
                serial={index + 1}
                document={doc}
                canDelete={canDelete}
                canReplace={canReplace}
                deleting={deletingId === doc.id}
                busy={Boolean(deletingId)}
                replacing={replacing[doc.id]}
                onPreview={onPreview}
                onDelete={onDelete}
                onReplace={onReplace}
              />
            ))}
      </tbody>
    </table>
  </div>
);

export default DocumentTable;
