import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import Markdown from './Markdown';
import RetrievalOrigin from './RetrievalOrigin';
import { JsonDetails } from '../chunks/ChunkInspection';
import { citationLabel } from '../../utils/crag';
import { loadCitationParent } from '../../services/citationSource';
import useActiveDocumentId from '../../hooks/useActiveDocumentId';
import { referenceNotice } from '../../utils/crossReferences';

export const SourceContent = ({ citation, parent }) => {
  const metadata = parent?.metadata ?? {};
  return <div className="space-y-3 text-sm text-ink-2">
    <p className="font-semibold text-ink">{metadata.document_title ?? parent?.documentTitle ?? citation.documentTitle ?? 'Document title unavailable'}</p>
    <p>{(parent?.sourcePages ?? citation.sourcePages ?? metadata.source_pages)?.length ? `Pages ${(parent?.sourcePages ?? citation.sourcePages ?? metadata.source_pages).join(', ')}` :
      metadata.page_number != null ? `Page ${metadata.page_number}` : citationLabel(citation)}</p>
    <p>{(parent?.headingPath ?? metadata.heading_path)?.join(' › ') || citation.section || 'Section unavailable'}</p>
    <RetrievalOrigin origin={citation.retrievalOrigin ?? parent?.retrievalOrigin} />
    {referenceNotice(citation) && <p>{referenceNotice(citation)}</p>}
    {parent ? <>
      <Markdown>{parent.searchText || parent.text || 'Passage unavailable from this source.'}</Markdown>
      <p>Rows: {metadata.row_ids?.join(', ') || 'Unavailable'}</p>
      {metadata.token_budget ? <p>Token budget: {metadata.token_budget.tokenCount ?? 'Unavailable'} / {metadata.token_budget.tokenLimit ?? 'Unavailable'}
        {' · '}{metadata.token_budget.withinLimit === true ? 'Within limit' : metadata.token_budget.withinLimit === false ? 'Over limit' : 'Limit status unavailable'}</p>
        : <p>Token budget unavailable</p>}
      <JsonDetails title="Raw source JSON" value={parent} />
    </> : <>
      {citation.snippet && <div><p className="mb-2 font-semibold text-ink-2">Saved source preview</p><Markdown>{citation.snippet}</Markdown></div>}
      <p role="status">Full source passage unavailable in this conversation. Saved citations can remain available after refresh even when full retrieval details were not persisted.</p>
    </>}
  </div>;
};

const SourceDrawer = ({ citation, parent, onClose }) => {
  const ref = useRef(null);
  const titleId = useId();
  const documentId = useActiveDocumentId();
  const [saved, setSaved] = useState(null);
  const [loading, setLoading] = useState(!parent);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (parent) { setLoading(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    setSaved(null);
    setError(null);
    loadCitationParent(citation, { documentId, signal: controller.signal }).then((record) => {
      if (!controller.signal.aborted) setSaved(record);
    }).catch((failure) => {
      if (!controller.signal.aborted) setError(failure.message ?? 'Could not load the saved source.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [citation, parent, documentId]);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = ref.current;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(<dialog ref={ref} aria-labelledby={titleId} onCancel={(event) => {
    event.preventDefault(); onClose();
  }} onClick={(event) => { if (event.target === ref.current) onClose(); }}
    className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-none w-full max-w-xl border-l border-border bg-surface p-0 text-ink shadow-(--sh-lg) backdrop:bg-scrim/40">
    <div className="min-h-full p-5" onClick={(event) => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={titleId} className="font-display text-lg font-semibold">Source passage</h2>
        <button type="button" onClick={onClose} aria-label="Close source passage" className="rounded p-2 hover:bg-surface-2"><X className="h-4 w-4" /></button>
      </div>
      {loading ? <p role="status" className="text-sm text-muted">Loading saved source passage…</p> : <>
        {error && <p role="alert" className="mb-3 text-sm text-red">{error}</p>}
        <SourceContent citation={citation} parent={parent ?? saved} />
      </>}
    </div>
  </dialog>, document.body);
};

export default SourceDrawer;
