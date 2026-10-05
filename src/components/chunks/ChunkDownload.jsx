import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import Button from '../buttons/Button';
import documentService from '../../services/documentService';
import { buildChunkDownload, selectDownloadParents } from '../../utils/chunkDownload';

const ChunkDownload = ({ documentId, filename, parents, children, pages, loading }) => {
  const [scope, setScope] = useState('all');
  const [page, setPage] = useState('');
  const [format, setFormat] = useState('md');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controllerRef = useRef(null);

  useEffect(() => () => controllerRef.current?.abort(), []);
  const download = async () => {
    if (busy || loading || !parents.length || (scope === 'page' && (!Number.isInteger(Number(page)) || Number(page) < 1))) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setBusy(true);
    setError('');
    try {
      const responses = {};
      const pending = parents.filter((parent) => {
        const cached = children[parent.id];
        if (cached?.response && !cached.error) {
          responses[parent.id] = cached.response;
          return false;
        }
        return true;
      });
      // Keep the number of simultaneous authenticated requests bounded for
      // documents with hundreds of parent chunks.
      for (let index = 0; index < pending.length; index += 6) {
        const batch = pending.slice(index, index + 6);
        const results = await Promise.all(batch.map((parent) => documentService.getChildChunks(parent.id, controller.signal)));
        results.forEach((response, offset) => { responses[batch[offset].id] = response; });
      }
      if (controller.signal.aborted) return;
      for (const parent of parents) {
        const response = responses[parent.id];
        if (response?.documentId !== documentId || response?.parentId !== parent.id ||
          response?.parent?.documentId !== documentId || !Array.isArray(response?.children) ||
          response.children.some((child) => child.documentId !== documentId || child.parentId !== parent.id)) {
          throw new Error(`Incomplete or mismatched child response for parent ${parent.id}.`);
        }
      }
      const selected = selectDownloadParents(parents, responses, scope, page);
      if (!selected.length) {
        setError('No chunks match this download selection.');
        return;
      }
      const content = buildChunkDownload({ parents, childResponses: responses, scope, page, documentId, filename, format });
      const blob = new Blob([content], { type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `chunks-${documentId}-${scope}${scope === 'page' ? `-${page}` : ''}.${format}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message ?? 'Could not prepare the chunk download.');
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setBusy(false);
      }
    }
  };

  return (
    <div className="mt-5 rounded-(--radius) border border-border bg-surface p-4">
      <h3 className="font-display text-[14px] font-semibold text-ink">Download chunks</h3>
      <p className="mt-1 text-[11px] text-muted">Exports ordered parent and child records, link IDs, metadata, and child endpoint response information.</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-[11px] font-medium text-muted">Chunks
          <select aria-label="Download scope" value={scope} onChange={(event) => setScope(event.target.value)} className="mt-1 block h-9 rounded-(--radius-sm) border border-border-2 bg-surface px-2 text-[13px] text-ink">
            <option value="all">All chunks</option>
            <option value="page">Specific page chunks</option>
            <option value="across">Across-page chunks</option>
          </select>
        </label>
        {scope === 'page' && <label className="text-[11px] font-medium text-muted">Page
          <input aria-label="Download page" type="number" min="1" step="1" value={page} onChange={(event) => setPage(event.target.value)} placeholder={pages.length ? `e.g. ${pages[0]}` : 'Page number'} className="mt-1 block h-9 w-28 rounded-(--radius-sm) border border-border-2 bg-surface px-2 text-[13px] text-ink" />
        </label>}
        <label className="text-[11px] font-medium text-muted">Format
          <select aria-label="Download format" value={format} onChange={(event) => setFormat(event.target.value)} className="mt-1 block h-9 rounded-(--radius-sm) border border-border-2 bg-surface px-2 text-[13px] text-ink">
            <option value="md">Markdown (.md)</option>
            <option value="txt">Text (.txt)</option>
          </select>
        </label>
        <Button size="sm" onClick={download} loading={busy} disabled={loading || !parents.length || (scope === 'page' && (!Number.isInteger(Number(page)) || Number(page) < 1))}>
          <Download className="h-4 w-4" />Download
        </Button>
      </div>
      {busy && <p role="status" className="mt-2 text-[11px] text-muted">Loading all child records for the export…</p>}
      {error && <p role="alert" className="mt-2 text-[11px] text-red">{error}</p>}
    </div>
  );
};

export default ChunkDownload;
