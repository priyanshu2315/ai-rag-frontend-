import { useId } from 'react';
import { pdfPageUrl } from '../../utils/chatSources';
import { referenceNotice, referenceDefinitionLabel } from '../../utils/crossReferences';
import RetrievalOrigin from './RetrievalOrigin';
import { originIcon } from '../../utils/retrievalOrigin';

export const CitationTooltipContent = ({ citation, id, onOpen }) => <span id={id} role="tooltip"
  className="absolute bottom-full left-0 z-20 hidden w-64 max-w-[70vw] rounded-(--radius-sm) border border-border bg-surface p-3 text-left text-[12px] font-normal text-ink-2 shadow-(--sh-lg) group-hover/citation:block group-focus-within/citation:block">
  {citation.documentTitle && <span className="mb-1 block font-semibold">{citation.documentTitle}</span>}
  <strong className="block">{citation.displayLabel ?? citation.sourceId}</strong>
  <span className="mt-1 block text-muted">{citation.sourceId}</span>
  {citation.retrievalOrigin && <RetrievalOrigin origin={citation.retrievalOrigin} />}
  {referenceNotice(citation) && <span className="mt-1 block">{referenceNotice(citation)}</span>}
  {referenceDefinitionLabel(citation) && <span className="mt-1 block">{referenceDefinitionLabel(citation)}</span>}
  {citation.snippet && <span className="mt-1 block whitespace-pre-wrap break-words">{citation.snippet}</span>}
  <span className="mt-2 flex gap-3">
    {onOpen && <button type="button" onClick={() => onOpen(citation)} className="text-blue hover:underline">{pdfPageUrl(citation.fileUrl, citation.pageNumber) ? 'View in Document' : 'View source'}</button>}
    {pdfPageUrl(citation.fileUrl, citation.pageNumber) && <a href={pdfPageUrl(citation.fileUrl, citation.pageNumber)} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline">Open Source PDF</a>}
  </span>
</span>;

export const citationPillLabel = (citation) => {
  const page = /^Page\s/i.test(citation.sourceId ?? '') ? citation.sourceId : citation.pageNumber != null ? `Page ${citation.sourcePages?.length ? citation.sourcePages.join('-') : citation.pageNumber}` : citation.sourceId;
  const reference = citation.retrievalOrigin?.type === 'reference_following' ? ` (${citation.retrievalOrigin.reference ?? 'Reference followed'})` : '';
  return `${originIcon(citation.retrievalOrigin)} ${citation.documentTitle && page ? `${page}${reference} • ${citation.documentTitle}` : `${citation.displayLabel ?? citation.sourceId}${reference}`}`;
};

const CitationTooltip = ({ citation, children, onOpen }) => {
  const id = useId();
  return <span className="group/citation relative inline-flex">{children(id)}<CitationTooltipContent id={id} citation={citation} onOpen={onOpen} /></span>;
};

export default CitationTooltip;
