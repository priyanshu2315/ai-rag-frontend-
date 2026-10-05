import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Eye, Layers } from 'lucide-react';
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import Button from '../../components/buttons/Button';
import CopyButton from '../../components/buttons/CopyButton';
import DocumentPreview from '../../components/documents/DocumentPreview';
import ProcessingTimeline from '../../components/documents/ProcessingTimeline';
import SourcePages from '../../components/documents/SourcePages';
import ParentChunkRow from '../../components/chunks/ParentChunkRow';
import LiveParentRow from '../../components/chunks/LiveParentRow';
import { JsonDetails } from '../../components/chunks/ChunkInspection';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import Skeleton from '../../components/feedback/Skeleton';
import useDocumentChunks from '../../hooks/useDocumentChunks';
import usePageTitle from '../../hooks/usePageTitle';
import { DOCUMENT_STATUS, SUMMARY_STATUS, needsProgress } from '../../constants/documentStatus';
import { MESSAGES } from '../../constants/messages';
import { documentPath } from '../../constants/routes';
import { groupSections, matchesChunkSearch, pagesOf } from '../../utils/chunkInspector';
import { buildLiveSections, buildSourcePages, combineInspectorSections } from '../../utils/pipelineInspector';
import { watchProgress } from '../../services/progressStream';
import { documentProgressChanged } from '../../redux/slices/documentSlice';

const EMPTY_EVENTS = [];
const headingLabel = (path) => Array.isArray(path) && path.length
  ? path.join(' > ') : 'No heading breadcrumb returned';
const terminalTypes = new Set(['completed', 'failed', 'summary_failed']);

const Stat = ({ label, value }) => (
  <div className="rounded-(--radius-sm) bg-surface-2 px-3 py-2 text-[11px] text-muted">
    <span className="font-medium text-ink-2">{label}: </span>{value ?? 'Unavailable'}
  </div>
);

const SectionParts = ({ parts }) => parts.length > 0 && (
  <details className="mt-3 text-[11px] text-muted">
    <summary className="cursor-pointer font-medium hover:text-ink">Page parts · {parts.length}</summary>
    <div className="mt-2 space-y-2">
      {parts.map((part) => (
        <details key={`${part.page}:${part.partIndex}`} className="rounded-(--radius-sm) border border-border bg-surface-2 p-2">
          <summary className="cursor-pointer">Page {part.page} · part {part.partIndex} · {part.textLength ?? 'unknown'} characters</summary>
          <div className="mt-2 flex justify-end"><CopyButton text={part.text ?? ''} label="Copy section part" /></div>
          <pre className="mono mt-1 max-h-64 overflow-auto whitespace-pre rounded-(--radius-sm) bg-surface p-2 text-[12px] text-ink-2">{part.text ?? 'Text unavailable'}</pre>
          <JsonDetails className="mt-2" title="Exact section-part event" value={part} />
        </details>
      ))}
    </div>
  </details>
);

const ChunkExplorer = () => {
  usePageTitle('Document inspector');
  const { documentId } = useParams();
  const { activeDocument, openDocuments } = useOutletContext();
  const progress = useSelector((state) => state.documents.progressById[documentId]);
  const events = progress?.timeline ?? EMPTY_EVENTS;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [previewing, setPreviewing] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [pageFilter, setPageFilter] = useState('');
  const [query, setQuery] = useState('');
  const [jumpTarget, setJumpTarget] = useState(null);
  const [handledHash, setHandledHash] = useState('');

  const chunksReady = activeDocument?.status === DOCUMENT_STATUS.COMPLETED;
  const { parents, parentResponse, loading, error, children, expanded, toggle, collapseAll, retryChildren, reload } =
    useDocumentChunks(documentId, chunksReady);
  const savedSections = useMemo(() => groupSections(parents, documentId), [parents, documentId]);
  const liveSections = useMemo(() => buildLiveSections(events, documentId), [events, documentId]);
  const sections = useMemo(() => combineInspectorSections(savedSections, liveSections, chunksReady), [savedSections, liveSections, chunksReady]);
  const sourcePages = useMemo(() => buildSourcePages(events), [events]);
  const parentById = useMemo(() => new Map(parents.map((parent) => [parent.id, parent])), [parents]);
  const parentIndexById = useMemo(() => new Map(parents.map((parent, index) => [parent.id, index])), [parents]);
  const pages = useMemo(() => [...new Set(sections.flatMap((section) => section.pages))].sort((a, b) => a - b), [sections]);
  const visibleSections = useMemo(() => sections
    .filter((section) => !sectionFilter || section.key === sectionFilter)
    .map((section) => ({
      ...section,
      visibleParents: section.parents.filter((parent) =>
        (!pageFilter || pagesOf(parent.metadata).includes(Number(pageFilter))) &&
        matchesChunkSearch(parent, section.saved ? children[parent.id] : { items: parent.children }, query)
      ),
    }))
    .filter((section) => section.visibleParents.length > 0 ||
      (section.parents.length === 0 && !query.trim() && (!pageFilter || section.pages.includes(Number(pageFilter))))),
  [sections, sectionFilter, pageFilter, query, children]);

  const navigateParent = useCallback((targetId) => {
    if (!parentById.has(targetId)) return;
    setSectionFilter('');
    setPageFilter('');
    setQuery('');
    if (!expanded.has(targetId)) toggle(targetId);
    setJumpTarget(targetId);
  }, [parentById, expanded, toggle]);

  useEffect(() => {
    const key = `${documentId}:${location.hash}`;
    if (!location.hash.startsWith('#parent-') || handledHash === key) return;
    let targetId;
    try { targetId = decodeURIComponent(location.hash.slice('#parent-'.length)); }
    catch { return; }
    if (!parentById.has(targetId)) return;
    const frame = requestAnimationFrame(() => {
      setHandledHash(key);
      navigateParent(targetId);
    });
    return () => cancelAnimationFrame(frame);
  }, [documentId, location.hash, handledHash, parentById, navigateParent]);

  useEffect(() => {
    if (!jumpTarget) return undefined;
    const frame = requestAnimationFrame(() => {
      const row = window.document.getElementById(`parent-${jumpTarget}`);
      if (row) {
        const section = row.closest('details');
        if (section) section.open = true;
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setJumpTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [jumpTarget, visibleSections]);

  // Completed documents have no shell watcher. Reopen once to replay retained
  // events; REST still supplies the saved tree when Redis history has expired.
  const hasTerminalEvent = events.some((event) => terminalTypes.has(event.type));
  useEffect(() => {
    if (!activeDocument || needsProgress(activeDocument) || hasTerminalEvent) return undefined;
    const controller = new AbortController();
    watchProgress(documentId, {
      signal: controller.signal,
      onEvent: (event) => dispatch(documentProgressChanged({ id: documentId, progressAction: { type: 'event', event } })),
    });
    return () => controller.abort();
  }, [documentId, activeDocument, hasTerminalEvent, dispatch]);

  const filename = activeDocument?.filename ?? 'this document';
  const summaryStatus = activeDocument?.summaryStatus;
  const splitter = events.find((event) => event.type === 'chunking_start');
  const complete = [...events].reverse().find((event) => event.type === 'chunking_complete');
  const sourcePageTotal = splitter?.totalPages ?? complete?.totalPages;
  const childTotal = chunksReady && !loading && parents.every((parent) => parent.totalChildren != null)
    ? parents.reduce((sum, parent) => sum + parent.totalChildren, 0)
    : complete?.totalChildren;

  return (
    <>
      <Topbar
        title="Document inspector"
        subtitle={filename}
        onOpenDocuments={openDocuments}
        actions={
          <>
            {activeDocument?.fileUrl && (
              <Button variant="ghost" size="sm" className="h-10 shrink-0 xl:h-8" onClick={() => setPreviewing(true)} title="Preview this file" aria-label="Preview file">
                <Eye className="h-4 w-4" /><span className="hidden sm:inline">Preview file</span>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-10 shrink-0 xl:h-8" onClick={() => navigate(documentPath(documentId))} title="Back to chat">
              <ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Back to chat</span>
            </Button>
          </>
        }
      />
      {previewing && activeDocument?.fileUrl && <DocumentPreview file={activeDocument} onClose={() => setPreviewing(false)} />}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
          <div className="rounded-(--radius) border border-border bg-surface p-4 shadow-(--sh-sm)">
            <h2 className="break-words font-display text-[15px] font-semibold text-ink">{filename}</h2>
            <p className="mono mt-1 break-all text-[11px] text-muted">Document ID: {documentId} <CopyButton text={documentId} label="Copy document ID" /></p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label="Chunks" value={chunksReady ? 'Ready for questions' : activeDocument?.status ?? 'Checking'} />
              <Stat label="Summary" value={summaryStatus === SUMMARY_STATUS.COMPLETED ? 'Ready' : summaryStatus ?? 'Checking'} />
              {sourcePageTotal > 0 && <Stat label="Source pages" value={sourcePageTotal} />}
              <Stat label="Sections" value={complete?.totalSections ?? (sections.length ? `${sections.length} visible` : null)} />
              <Stat label={chunksReady ? 'Saved parents' : 'Prepared parents seen'} value={chunksReady && loading && parents.length === 0 ? 'Loading' : chunksReady ? parents.length : liveSections.reduce((sum, section) => sum + section.parents.length, 0)} />
              <Stat label="Total children" value={childTotal ?? 'Unavailable'} />
              <Stat label="Represented pages" value={pages.length ? pages.join(', ') : null} />
            </div>
            {splitter ? (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                <span>Chunker: {splitter.chunkerVersion ?? 'Unavailable'}</span>
                <span>Parents: {splitter.parentChunkSize} / overlap {splitter.parentChunkOverlap} {splitter.sizeUnit}</span>
                <span>Children: {splitter.childChunkSize} / overlap {splitter.childChunkOverlap} {splitter.sizeUnit}</span>
              </div>
            ) : <p className="mt-2 text-[11px] text-muted">Splitter settings require retained processing events.</p>}
            {chunksReady && summaryStatus === SUMMARY_STATUS.PROCESSING && <p className="mt-2 text-[12px] text-blue">Questions ready; summary processing.</p>}
            {chunksReady && summaryStatus === SUMMARY_STATUS.FAILED && <p className="mt-2 text-[12px] text-muted">Summary failed; document questions remain available.</p>}
          </div>

          {events.length > 0 && <ProcessingTimeline events={events} />}
          {sourcePages.length > 0 && <SourcePages pages={sourcePages} />}
          {progress?.phase === 'error' && <div className="mt-5"><ErrorState message={progress.message ?? 'Progress updates are unavailable.'} /></div>}

          {!activeDocument && <p className="mt-5 text-center text-[13px] text-muted">Loading document status…</p>}
          {activeDocument?.status === DOCUMENT_STATUS.FAILED && <div className="mt-5"><ErrorState message="Document processing failed before chunks were saved." /></div>}
          {activeDocument?.status === DOCUMENT_STATUS.PROCESSING && (
            <p className="mt-5 rounded-(--radius-sm) bg-blue-lt p-3 text-[12px] text-ink-2">Live parent and child details are in memory. Saved REST records and full vectors become available after chunks_ready.</p>
          )}

          {(sections.length > 0 || chunksReady) && (
            <>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                {expanded.size > 0 && (
                  <button type="button" onClick={collapseAll} className="h-9 rounded-(--radius-sm) border border-border-2 px-3 text-[11px] font-medium text-ink-2 hover:bg-surface-2">
                    Close all parent chunks
                  </button>
                )}
                <label className="min-w-40 flex-1 text-[11px] font-medium text-muted">Search passage or chunk ID
                  <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search loaded chunks" className="mt-1 h-9 w-full rounded-(--radius-sm) border border-border-2 bg-surface px-3 text-[13px] text-ink outline-none focus:border-blue" />
                </label>
                <label className="text-[11px] font-medium text-muted">Section
                  <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="mt-1 block h-9 max-w-60 rounded-(--radius-sm) border border-border-2 bg-surface px-2 text-[13px] text-ink">
                    <option value="">All sections</option>
                    {sections.map((section) => <option key={section.key} value={section.key}>{headingLabel(section.headingPath)} ({section.sectionId ?? 'no ID'})</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-medium text-muted">Page
                  <select value={pageFilter} onChange={(event) => setPageFilter(event.target.value)} className="mt-1 block h-9 rounded-(--radius-sm) border border-border-2 bg-surface px-2 text-[13px] text-ink">
                    <option value="">All pages</option>
                    {pages.map((page) => <option key={page} value={page}>Page {page}</option>)}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-[11px] text-muted">Search includes saved parents and children already loaded by expanding a parent. Prepared children are searchable while event history is available.</p>
              {parentResponse && <JsonDetails className="mt-2 text-[11px] text-muted" title="Exact parent endpoint data" value={parentResponse} />}
              {loading && parents.length === 0 && <div className="mt-4 space-y-2">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>}
              {error && parents.length === 0 && <div className="mt-4"><ErrorState message={error} onRetry={reload} /></div>}
              {!loading && !error && sections.length === 0 && <EmptyState icon={Layers} title={MESSAGES.NO_PARENT_CHUNKS} description="Saved chunks will appear here when the document is ready." />}
              {sections.length > 0 && visibleSections.length === 0 && <p className="mt-5 text-[13px] text-muted">No loaded chunks match these filters.</p>}

              <div className="mt-4 space-y-3">
                {visibleSections.map((section) => (
                  <details key={section.key} open className="rounded-(--radius) border border-border bg-surface p-3">
                    <summary className="cursor-pointer font-display text-[14px] font-semibold text-ink">
                      {headingLabel(section.headingPath)}
                      <span className="ml-2 text-[11px] font-normal text-muted">{section.saved
                        ? `${section.visibleParents.length} shown / ${section.totalParents ?? section.parents.length} saved parents`
                        : `${section.visibleParents.length} shown / ${section.parents.length} prepared parents seen${section.totalParents != null ? ` · ${section.totalParents} reported total` : ''}`}</span>
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                      <span className="mono break-all">Section ID: {section.sectionId ?? 'Unavailable'}</span>
                      <span>Pages: {section.pages.length ? section.pages.join(', ') : 'Unavailable'}</span>
                      <span>Children: {section.totalChildren ?? 'total unavailable'}{!section.saved && ` · ${section.parents.reduce((sum, parent) => sum + parent.children.length, 0)} seen`}</span>
                      <span>{section.saved ? 'Saved REST records' : 'Live preparation events'}</span>
                    </div>
                    <SectionParts parts={section.parts ?? []} />
                    {section.parents.length === 0 && <p className="mt-3 text-[12px] text-muted">No parent passages reported for this section.</p>}
                    <ol className="mt-3 space-y-2">
                      {section.visibleParents.map((chunk, index) => section.saved ? (
                        <ParentChunkRow key={chunk.id} chunk={chunk} index={parentIndexById.get(chunk.id)} open={expanded.has(chunk.id)} entry={children[chunk.id]} onToggle={toggle} onRetry={retryChildren} onNavigate={navigateParent} parentById={parentById} />
                      ) : <LiveParentRow key={chunk.id ?? index} parent={chunk} />)}
                    </ol>
                  </details>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ChunkExplorer;
