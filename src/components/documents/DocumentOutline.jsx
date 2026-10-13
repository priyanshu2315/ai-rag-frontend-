const outlineEntries = (outline) => Array.isArray(outline) ? outline.filter((entry) => entry &&
  typeof entry === 'object' && !Array.isArray(entry) && typeof entry.title === 'string' && typeof entry.sectionCode === 'string') : [];

const DocumentOutline = ({ outline, onPageJump, currentPage, disabled = false }) => {
  const entries = outlineEntries(outline);
  if (!entries.length) return null;
  return <details className="max-h-[30dvh] shrink-0 overflow-auto border-b border-border bg-surface p-3 sm:max-h-none sm:w-64 sm:border-r sm:border-b-0" aria-label="Document Outline">
    <summary className="cursor-pointer text-sm font-semibold text-ink">Document Outline</summary>
    <nav aria-label="Document sections" className="mt-2"><ul className="space-y-1">{entries.map((entry, index) => {
      const canJump = !disabled && Number.isInteger(entry.targetPage) && entry.targetPage > 0;
      return <li key={`${entry.sectionCode}-${index}`}><button type="button" disabled={!canJump}
        aria-current={canJump && currentPage === entry.targetPage ? 'page' : undefined}
        onClick={() => { if (canJump) onPageJump(entry.targetPage); }}
        className="w-full rounded-(--radius-sm) p-2 text-left text-[12px] text-ink-2 hover:bg-surface-2 disabled:cursor-default disabled:text-muted">
        <span className="block font-semibold">{entry.sectionCode}</span><span className="block break-words">{entry.title}</span>
        <span className="mt-1 block text-[11px] text-muted">{Number.isInteger(entry.targetPage) && entry.targetPage > 0 ? `Page ${entry.targetPage}` : 'Page unavailable'}{Number.isInteger(entry.pageCount) && entry.pageCount > 0 ? ` · ${entry.pageCount} pages` : ''}</span>
      </button></li>;
    })}</ul></nav>
  </details>;
};
export default DocumentOutline;
