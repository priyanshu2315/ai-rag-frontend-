import { JsonDetails } from '../chunks/ChunkInspection';
import CopyButton from '../buttons/CopyButton';

const SourcePages = ({ pages }) => (
  <details className="mt-5 rounded-(--radius) border border-border bg-surface p-4">
    <summary className="cursor-pointer font-display text-[14px] font-semibold text-ink">Source pages · {pages.length} replayed</summary>
    {pages.length === 0 ? (
      <p className="mt-3 text-[12px] text-muted">Extracted pages and heading decisions are available only while progress event history is retained.</p>
    ) : (
      <div className="mt-3 space-y-3">
        {pages.map((page) => (
          <section key={page.number} className="rounded-(--radius-sm) border border-border bg-surface-2 p-3">
            <h3 className="font-display text-[13px] font-semibold text-ink">Page {page.number}{page.textLength != null && <span className="ml-2 text-[11px] font-normal text-muted">{page.textLength} characters reported</span>}</h3>
            {page.text !== null ? (
              <>
                <div className="mt-2 flex justify-end"><CopyButton text={page.text} label={`Copy page ${page.number} text`} /></div>
                <pre className="mono mt-1 max-h-72 overflow-auto whitespace-pre rounded-(--radius-sm) bg-surface p-3 text-[12px] text-ink-2">{page.text}</pre>
              </>
            ) : <p className="mt-2 text-[12px] text-muted">Extracted text was not received for this page.</p>}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-2">Detected headings · {page.headings.length}</p>
            {page.headings.map((heading, index) => (
              <div key={heading.eventId ?? index} className="mt-1 text-[11px] text-ink-2">
                Line {heading.lineNumber}: {heading.title} · level {heading.level} · {heading.format} · repeated: {String(heading.repeated)}
                {heading.text && heading.text !== heading.title && <span> · source line: {heading.text}</span>}
              </div>
            ))}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-2">Code-fence decisions · {page.fences.length}</p>
            {page.fences.map((fence, index) => (
              <div key={fence.eventId ?? index} className="mt-1 text-[11px] text-ink-2">
                Line {fence.lineNumber}: {fence.text} · inside code block: {String(fence.insideCodeBlock)}
              </div>
            ))}
            <JsonDetails className="mt-3 text-[11px] text-muted" title="Exact heading and fence events" value={[...page.headings, ...page.fences]} />
          </section>
        ))}
      </div>
    )}
  </details>
);

export default SourcePages;
