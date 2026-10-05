import { JsonDetails } from '../chunks/ChunkInspection';

const phaseOf = (type) => {
  if (['extraction_start', 'page_extracted', 'heading_detected', 'code_fence'].includes(type)) return 'Extraction';
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

const ProcessingTimeline = ({ events }) => (
  <details className="mt-5 rounded-(--radius) border border-border bg-surface p-4">
    <summary className="cursor-pointer font-display text-[14px] font-semibold text-ink">Processing timeline · {events.length} received events</summary>
    {events.length === 0 ? (
      <p className="mt-3 text-[12px] text-muted">No replayed or live events are available. Saved chunks can still be inspected after processing.</p>
    ) : (
      <ol className="mt-3 space-y-2">
        {events.map((event, index) => (
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
  </details>
);

export default ProcessingTimeline;
