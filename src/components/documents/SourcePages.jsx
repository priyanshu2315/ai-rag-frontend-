import { useState } from 'react';
import { JsonDetails } from '../chunks/ChunkInspection';
import { EvidenceFields } from '../chunks/StructuredDetails';
import Markdown from '../chat/Markdown';
import CopyButton from '../buttons/CopyButton';

const SourcePages = ({ pages }) => {
  const [limit, setLimit] = useState(20);
  return <details className="mt-5 rounded-(--radius) border border-border bg-surface p-4">
    <summary className="cursor-pointer font-display text-[14px] font-semibold text-ink">Extracted sources ? {pages.length} received live</summary>
    <p className="mt-2 text-[12px] text-muted">Original extraction text is available only for sources captured in this session. Missing sources cannot be restored through REST; there is no backend replay.</p>
    <div className="mt-3 space-y-3">{pages.slice(0, limit).map((page) => <details key={page.id} className="rounded-(--radius-sm) border border-border bg-surface-2 p-3">
      <summary className="cursor-pointer text-[13px] font-semibold text-ink">{page.number != null ? `Physical page ${page.number}` : `${page.source?.kind === 'rendered_page' ? 'Rendered source' : 'Source'} ${page.source?.id ?? page.id}`}</summary>
      <EvidenceFields value={{ sourceId: page.source?.id ?? page.id, kind: page.source?.kind, physicalPage: page.source?.sourcePageNumber ?? page.number, parserPage: page.source?.parserPageNumber, sequenceIndex: page.source?.sequenceIndex, format: page.source?.textFormat, textLength: page.textLength, parserItemCount: page.parserItemCount ?? 'Unavailable', warnings: page.source?.warnings }} />
      {page.text != null ? <>
        <CopyButton text={page.text} label="Copy extracted source" />
        <details><summary className="cursor-pointer text-[12px] text-muted">Original raw text</summary><pre className="mono max-h-72 overflow-auto whitespace-pre-wrap p-3 text-[12px] text-ink-2">{page.text}</pre></details>
        <details><summary className="cursor-pointer text-[12px] text-muted">Safe Markdown</summary><div className="max-h-72 overflow-auto p-3 text-[12px] text-ink-2"><Markdown>{page.text}</Markdown></div></details>
      </> : <p className="text-[12px] text-muted">Extracted text unavailable.</p>}
      <JsonDetails title="Captured heading/source decisions" value={[...page.headings, ...page.fences]} />
    </details>)}</div>
    {pages.length > limit && <button type="button" onClick={() => setLimit((value) => value + 20)} className="mt-3 text-blue">Show more sources</button>}
  </details>;
};
export default SourcePages;
