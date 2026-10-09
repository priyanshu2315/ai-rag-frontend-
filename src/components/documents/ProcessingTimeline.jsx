import { useState } from 'react';
import { JsonDetails } from '../chunks/ChunkInspection';

const phaseOf = (type) => {
  if (type.startsWith('gemini_extraction_') || type === 'page_transcribed') return 'Gemini extraction';
  if (type.startsWith('markdown_correction_') || type === 'page_corrected') return 'Markdown correction';
  if (['extraction_complete', 'extraction_start', 'page_extracted', 'heading_detected', 'code_fence'].includes(type)) return 'Extraction';
  if (['document_identity', 'heading_decision'].includes(type)) return 'Headings';
  if (['structure_resolved', 'section', 'section_part'].includes(type)) return 'Structure';
  if (['chunking_failed', 'embedding_failed', 'failed'].includes(type)) return 'Errors';
  if (['embedding_start', 'embedding_failed', 'child'].includes(type)) return 'Embedding';
  if (['saving_chunks', 'chunks_saved'].includes(type)) return 'Saving';
  if (['chunks_ready', 'summarizing', 'completed', 'summary_failed'].includes(type)) return 'Readiness / summary';
  if (type === 'failed') return 'Failure';
  return 'Preparation';
};

const detailsOf = (event) => [
  event.page != null && `page ${event.page}`,
  event.sectionId && `section ${event.sectionId}`,
  event.parentId && `parent ${event.parentId}`,
  event.childId && `child ${event.childId}`,
  event.message,
].filter(Boolean).join(' · ');

const localTime = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
};

const ProcessingTimeline = ({ events }) => {
  const [filter, setFilter] = useState('All');
  const [limit, setLimit] = useState(100);
  const filtered = events.filter((event) => filter === 'All' || (filter === 'Warnings' ? event.warnings?.length || event.decision?.warnings?.length || event.metadata?.structure_warnings?.length || event.type.endsWith('_failed') : phaseOf(event.type) === filter));
  return (
  <details className="mt-5 rounded-(--radius) border border-border bg-surface p-4">
    <summary className="cursor-pointer font-display text-[14px] font-semibold text-ink">Processing timeline · {events.length} received events</summary>
    <select aria-label="Timeline category" value={filter} onChange={(event) => { setFilter(event.target.value); setLimit(100); }} className="mt-2 rounded border border-border bg-surface text-[12px] text-ink">
      {['All', 'Gemini extraction', 'Markdown correction', 'Extraction', 'Headings', 'Structure', 'Preparation', 'Embedding', 'Saving', 'Readiness / summary', 'Warnings', 'Errors'].map((name) => <option key={name}>{name}</option>)}
    </select>
    {events.length === 0 ? (
      <p className="mt-3 text-[12px] text-muted">Full event history is unavailable because no live events were captured in this session. Saved chunks can still be inspected after processing.</p>
    ) : (
      <ol className="mt-3 space-y-2">
        {filtered.slice(0, limit).map((event, index) => (
          <li key={event.eventId ?? `${event.type}-${index}`} className="rounded-(--radius-sm) border border-border bg-surface-2 p-3 text-[11px]">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <strong className="mono text-ink">{event.type}</strong>
              <span className="text-muted">{phaseOf(event.type)}</span>
              {event.stage && <span className="text-blue">Stage: {event.stage}</span>}
              {event.timestamp && <time dateTime={event.timestamp} className="ml-auto text-muted">{localTime(event.timestamp)}</time>}
            </div>
            {detailsOf(event) && <p className="mt-1 break-all text-ink-2">{detailsOf(event)}</p>}
            <JsonDetails className="mt-1 text-muted" title="Exact event JSON" value={event} />
          </li>
        ))}
      </ol>
    )}
    {filtered.length > limit && <button type="button" onClick={() => setLimit((value) => value + 100)} className="mt-2 text-blue">Show next 100 events</button>}
  </details>
  );
};

export default ProcessingTimeline;
