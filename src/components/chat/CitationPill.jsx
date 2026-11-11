import { originIcon } from '../../utils/retrievalOrigin';

/**
 * A citation chip's text, split so the long part can be cut short: the file
 * name first, then where in it (page, reference followed). `fileName` is the
 * uploaded file's name; without it the document title leads, and without
 * either there is only the label.
 */
export const citationPillParts = (citation, fileName) => {
  const page = /^Page\s/i.test(citation.sourceId ?? '') ? citation.sourceId : citation.pageNumber != null ? `Page ${citation.sourcePages?.length ? citation.sourcePages.join('-') : citation.pageNumber}` : citation.sourceId;
  const reference = citation.retrievalOrigin?.type === 'reference_following' ? ` (${citation.retrievalOrigin.reference ?? 'Reference followed'})` : '';
  const icon = originIcon(citation.retrievalOrigin);
  if ((fileName || citation.documentTitle) && page) return { icon, name: fileName || citation.documentTitle, detail: `${page}${reference}` };
  return { icon, name: `${citation.displayLabel ?? citation.sourceId}${reference}`, detail: '' };
};

/** The whole chip as one string: the hover text, so a cut-short name is never lost. The title joins it when the file name leads. */
export const citationPillLabel = (citation, fileName) => {
  const { icon, name, detail } = citationPillParts(citation, fileName);
  const title = fileName && citation.documentTitle && citation.documentTitle !== fileName ? ` — ${citation.documentTitle}` : '';
  return `${icon} ${detail ? `${name}${title} • ${detail}` : `${name}${title}`}`;
};

/** Chip text: small, name cut short with an ellipsis, the page always visible. */
export const CitationPillText = ({ citation, fileName }) => {
  const { icon, name, detail } = citationPillParts(citation, fileName);
  return (
    <>
      <span aria-hidden="true" className="shrink-0">{icon}</span>
      <span className="min-w-0 max-w-[14rem] truncate sm:max-w-[18rem]">{name}</span>
      {detail && <span className="shrink-0 opacity-75">• {detail}</span>}
    </>
  );
};

export const citationPillClass = 'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-px text-[10.5px] leading-4 font-medium hover:bg-surface-2';
