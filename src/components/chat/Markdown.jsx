import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import withPlainMath from '../../utils/math';
import remarkCitations from '../../utils/remarkCitations';
import { citationLabel } from '../../utils/crag';
import { resolveCitations } from '../../utils/chatSources';
import CitationTooltip, { citationPillLabel } from './CitationTooltip';
import { originStyle } from '../../utils/retrievalOrigin';

/**
 * Answers come back as markdown, so the bubble renders it rather than showing
 * the literal `**syntax**`.
 *
 * Raw HTML is deliberately NOT enabled (no rehype-raw): the answer text is
 * model output built from user-supplied documents, so it is untrusted. Without
 * that plugin react-markdown escapes any HTML in the source.
 *
 * Every element is mapped to design tokens here, so prose styling is defined
 * once instead of leaking into the bubble.
 */
const components = {
  p: ({ children }) => <p className="mb-3 leading-relaxed last:mb-0">{children}</p>,

  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-muted line-through">{children}</del>,

  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue underline underline-offset-2 hover:text-blue-dk"
    >
      {children}
    </a>
  ),

  ul: ({ children }) => <ul className="mb-3 ml-5 list-disc space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed pl-0.5">{children}</li>,

  h1: ({ children }) => <h1 className="mb-2 mt-4 font-display text-base font-semibold first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-4 font-display text-[15px] font-semibold first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-3 font-display text-sm font-semibold first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-3 font-display text-sm font-semibold first:mt-0">{children}</h4>,

  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-2 border-border-2 pl-3 text-ink-2 last:mb-0">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-4 border-border" />,

  // `inline` was dropped in react-markdown v9 — a fenced block arrives wrapped
  // in <pre>, so `pre` handles the block case and this only ever styles inline.
  code: ({ children, className }) => (
    <code
      className={
        className
          ? 'mono text-[12.5px] leading-relaxed'
          : 'mono rounded-(--radius-sm) border border-border bg-surface-2 px-1 py-0.5 text-[12.5px]'
      }
    >
      {children}
    </code>
  ),

  pre: ({ children }) => (
    <pre className="mb-3 overflow-x-auto rounded-(--radius-sm) border border-border bg-surface-2 p-3 last:mb-0">
      {children}
    </pre>
  ),

  // Wide tables scroll inside the bubble instead of stretching it.
  table: ({ children }) => (
    <div className="mb-3 max-w-full overflow-x-auto last:mb-0">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-2">{children}</thead>,
  th: ({ children }) => (
    <th className="border border-border px-2.5 py-1.5 text-left font-semibold text-ink">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2.5 py-1.5 align-top">{children}</td>,
};

export const CitationBadge = ({ citation, onCitation, describedBy }) => <button type="button"
  onClick={() => onCitation(citation)} aria-label={`Open source: ${citation.raw ?? citation.displayLabel ?? citation.sourceId}`}
  aria-describedby={describedBy}
  className={`mx-0.5 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium hover:bg-surface-2 ${originStyle(citation.retrievalOrigin ?? { type: 'search' })}`}>
  {citation.retrievalOrigin || (citation.documentTitle && citation.pageNumber != null) ? citationPillLabel(citation) : citationLabel(citation)}
</button>;

const Markdown = memo(({ children, onCitation, citations = [], citationIndex }) => {
  // Recomputed on every fragment while an answer streams, so it is worth not
  // running the rewrite again for a re-render that changed nothing else.
  const source = useMemo(() => withPlainMath(children), [children]);
  const renderers = useMemo(() => !onCitation ? components : {
    ...components,
    a: ({ node, ...props }) => {
      const raw = node?.properties?.['data-source-citation'];
      const resolved = typeof raw === 'string' ? resolveCitations(raw, citations, citationIndex)[0] : null;
      if (!resolved) return components.a(props);
      if (!resolved.citation) return <span className="mx-0.5 inline-flex rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] text-muted" title="Source details unavailable for this message">[{resolved.label}]</span>;
      const citation = resolved.citation;
      return <CitationTooltip citation={citation} onOpen={onCitation}>{(id) => <CitationBadge citation={citation} onCitation={onCitation} describedBy={id} />}</CitationTooltip>;
    },
  }, [onCitation, citations, citationIndex]);

  return (
    <ReactMarkdown remarkPlugins={onCitation ? [remarkGfm, [remarkCitations, { citations, citationIndex }]] : [remarkGfm]} components={renderers}>
      {source}
    </ReactMarkdown>
  );
});

Markdown.displayName = 'Markdown';

export default Markdown;
