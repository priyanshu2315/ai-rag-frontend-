import { useId, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { ChevronDown, GitCompare, Layers, MessageSquare } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import Button from '../../components/buttons/Button';
import ChangeCard from '../../components/changes/ChangeCard';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { TextSkeleton } from '../../components/feedback/Skeletons';
import Skeleton from '../../components/feedback/Skeleton';
import useDocumentChanges from '../../hooks/useDocumentChanges';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, chunksPath, documentPath } from '../../constants/routes';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "6 parts unchanged · 3 changed · 0 added · 0 removed" */
const summaryLine = (data) => {
  const count = (type) => data.changes.filter((change) => change.type === type).length;
  return [
    `${plural(data.keptChunks ?? 0, 'part')} unchanged`,
    `${count('changed')} changed`,
    `${count('added')} added`,
    `${count('removed')} removed`,
  ].join(' · ');
};

const CardsSkeleton = () => (
  <div className="flex flex-col gap-3" aria-busy="true">
    {[0, 1].map((key) => (
      <div key={key} className="rounded-(--radius) border border-border bg-surface p-4">
        <Skeleton className="mb-3 h-4 w-48" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * What changed in one version of a document, against the version before it
 * (`/documents/:id/changes?version=N`). Any user who can open the document
 * can open this; a 404 (gone, or no access) is handled by the shell like on
 * every document page.
 */
const DocumentChanges = () => {
  const { documentId } = useParams();
  const { activeDocument } = useOutletContext();
  const navigate = useNavigate();
  const pickerId = useId();
  const [changedOnly, setChangedOnly] = useState(false);
  const { data, loading, error, requested, selectVersion, reload } = useDocumentChanges(documentId);

  const filename = activeDocument?.filename ?? null;
  const currentVersion = Number(data?.currentVersion ?? activeDocument?.version) || null;
  const shownVersion = data?.version ?? (requested ? Number(requested) : currentVersion);
  usePageTitle(filename ? `What changed · ${filename}` : 'What changed');

  // v2 … current, newest first: the latest is what people come here for.
  const versions = useMemo(() => {
    const list = [];
    for (let v = currentVersion ?? 0; v >= 2; v -= 1) list.push(v);
    return list;
  }, [currentVersion]);
  const hasChangedCards = data?.changes.some((change) => change.type === 'changed');

  return (
    <>
      <PageHead
        crumbs={[
          { label: 'Knowledge base', to: ROUTES.KNOWLEDGE_BASE },
          ...(filename ? [{ label: filename, to: documentPath(documentId) }] : []),
        ]}
        title={filename
          ? <>{filename}{currentVersion > 1 && <span className="mono ml-2 text-[12px] font-medium text-muted">v{currentVersion}</span>}</>
          : <TextSkeleton className="h-4 w-48" />}
        subtitle="What changed between versions"
        actions={(
          <>
            <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={() => navigate(documentPath(documentId))} title="Back to the document chat">
              <MessageSquare className="h-4 w-4" /><span className="hidden sm:inline">Chat</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={() => navigate(chunksPath(documentId))} title="Inspect this document's chunks">
              <Layers className="h-4 w-4" /><span className="hidden sm:inline">Chunks</span>
            </Button>
          </>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {versions.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor={pickerId} className="text-[13px] text-muted">Version</label>
                <div className="relative">
                  <select
                    id={pickerId}
                    value={versions.includes(shownVersion) ? shownVersion : ''}
                    onChange={(event) => selectVersion(event.target.value)}
                    className="h-9 appearance-none rounded-(--radius-sm) border border-input-border bg-surface pr-8 pl-3 text-base text-ink focus:border-blue focus:ring-2 focus:ring-blue-lt focus:outline-none sm:text-[13px]"
                  >
                    {!versions.includes(shownVersion) && <option value="" disabled>Choose…</option>}
                    {versions.map((v) => (
                      <option key={v} value={v}>v{v - 1} → v{v}{v === currentVersion ? ' (latest)' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted" />
                </div>
              </div>
            )}

            <p className="min-w-0 flex-1 text-[13px] text-ink-2" role="status">
              {data ? summaryLine(data) : loading ? <TextSkeleton className="h-3 w-64" /> : null}
            </p>

            {hasChangedCards && (
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2 select-none">
                <input
                  type="checkbox"
                  checked={changedOnly}
                  onChange={(event) => setChangedOnly(event.target.checked)}
                  className="h-4 w-4 accent-(--color-blue)"
                />
                Show only changed lines
              </label>
            )}
          </div>

          {error ? (
            <div className="rounded-(--radius) border border-border bg-surface">
              <ErrorState message={error} onRetry={reload} />
            </div>
          ) : !data ? (
            <CardsSkeleton />
          ) : data.changes.length === 0 ? (
            <EmptyState icon={GitCompare} title="No content changes in this version." description={`${plural(data.keptChunks ?? 0, 'part')} carried over unchanged.`} />
          ) : (
            data.changes.map((change, index) => (
              <ChangeCard
                // Chunk ids are unique per side; the index covers a malformed entry.
                key={change.after?.id ?? change.before?.id ?? index}
                change={change}
                changedOnly={changedOnly}
              />
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default DocumentChanges;
