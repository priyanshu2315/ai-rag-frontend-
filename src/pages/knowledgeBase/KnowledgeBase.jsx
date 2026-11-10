import { useMemo, useState } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { BookOpen, Search, Upload } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import DocumentTable from '../../components/documents/DocumentTable';
import DocumentPreview from '../../components/documents/DocumentPreview';
import EmptyState from '../../components/feedback/EmptyState';
import { TextSkeleton } from '../../components/feedback/Skeletons';
import ErrorState from '../../components/feedback/ErrorState';
import usePageTitle from '../../hooks/usePageTitle';
import usePermission from '../../hooks/usePermission';
import { PERMISSIONS } from '../../constants/permissions';
import { ROUTES } from '../../constants/routes';
import { MESSAGES } from '../../constants/messages';
import { filterByQuery } from '../../utils/match';

/**
 * The documents this account can access — every document for an admin, the
 * documents in the user's roles for everyone else. The backend does that
 * filtering; this page lists whatever `my-documents` returns.
 *
 * The filter lives in the URL (`?q=`), so a refresh or a shared link keeps it.
 */
const KnowledgeBase = () => {
  usePageTitle('Knowledge base');

  const {
    documents, documentsLoading, documentsLoaded, documentsError, reloadDocuments, requestDelete, deletingId,
  } = useOutletContext();
  const { can, isAdmin } = usePermission();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  // An id, not the document: if it is deleted or access is revoked while
  // open, the lookup comes back empty and the preview closes itself.
  const [previewId, setPreviewId] = useState(null);
  const previewing = previewId ? documents.find((doc) => doc.id === previewId) : null;

  // Forgiving match: "fin 2" finds FIN-02_Budget.pdf.
  const visible = useMemo(() => filterByQuery(documents, query, (doc) => doc.filename), [documents, query]);

  const setQuery = (value) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set('q', value);
      else next.delete('q');
      return next;
    }, { replace: true });

  const count = documents.length;
  const subtitle = isAdmin
    ? `${count} document${count === 1 ? '' : 's'} in the library`
    : `${count} document${count === 1 ? '' : 's'} shared with you through your roles`;

  return (
    <>
      <PageHead
        title="Knowledge base"
        subtitle={!documentsLoaded ? <TextSkeleton className="h-3 w-44" /> : subtitle}
        actions={can(PERMISSIONS.UPLOAD_DOCUMENT) && (
          <Link
            to={ROUTES.UPLOAD}
            className="inline-flex h-9 items-center gap-2 rounded-(--radius-sm) bg-blue-solid px-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-solid-hover"
          >
            <Upload className="h-4 w-4" /> Upload
          </Link>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
          {documentsError ? (
            <ErrorState message={documentsError} onRetry={reloadDocuments} />
          ) : documentsLoaded && count === 0 ? (
            // Only once the first load is in: before that, "empty" is just "not here yet".
            <EmptyState
              icon={BookOpen}
              title={isAdmin ? 'No documents yet' : 'Nothing shared yet'}
              description={isAdmin
                ? 'Upload a document to start the library. Then add it to a role so users can see it.'
                : MESSAGES.NO_SHARED_DOCUMENTS}
              action={can(PERMISSIONS.UPLOAD_DOCUMENT) && (
                <Link to={ROUTES.UPLOAD} className="inline-flex h-10 items-center gap-2 rounded-(--radius-sm) bg-blue-solid px-4 text-sm font-semibold text-white hover:bg-blue-solid-hover">
                  <Upload className="h-4 w-4" /> Upload a document
                </Link>
              )}
            />
          ) : (
            <>
              <label className="flex min-h-11 items-center gap-2 rounded-(--radius) border border-input-border bg-surface px-3 text-muted focus-within:border-blue sm:max-w-sm">
                <Search className="h-4 w-4 shrink-0" />
                <span className="sr-only">Filter documents by name</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter by name…"
                  className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-2 sm:text-[13.5px]"
                />
              </label>

              {visible.length === 0 && documentsLoaded ? (
                <EmptyState
                  icon={Search}
                  title="No matching documents"
                  description={`Nothing named like “${query}”.`}
                />
              ) : (
                <DocumentTable
                  documents={visible}
                  loading={!documentsLoaded || documentsLoading}
                  canDelete={can(PERMISSIONS.DELETE_DOCUMENT)}
                  deletingId={deletingId}
                  onPreview={setPreviewId}
                  onDelete={requestDelete}
                />
              )}
            </>
          )}
        </div>
      </div>

      {previewing?.fileUrl && <DocumentPreview file={previewing} onClose={() => setPreviewId(null)} />}
    </>
  );
};

export default KnowledgeBase;
