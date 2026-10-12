import { Link } from 'react-router-dom';
import ChunkInspection, { JsonDetails } from '../chunks/ChunkInspection';
import CopyButton from '../buttons/CopyButton';
import { chunksPath } from '../../constants/routes';
import RetrievalOrigin from './RetrievalOrigin';
import { traceChunkLabel } from '../../utils/traceChunks';

const ParentCard = ({ parent, chunkLabels }) => {
  const link = parent.id && parent.documentId
    ? `${chunksPath(parent.documentId)}#parent-${encodeURIComponent(parent.id)}` : null;
  const origin = parent.retrievalOrigin;
  return (
    <details className="rounded-(--radius-sm) border border-border bg-surface-2 p-2">
      <summary className="cursor-pointer text-[11px] text-ink-2">
        <span>{traceChunkLabel(parent.id, chunkLabels, parent)}</span>
        {parent.metadata?.page_number != null && <span> · page {parent.metadata.page_number}</span>}
        {parent.retrievalScore != null && <span> · retrieval score {parent.retrievalScore}</span>}
        {parent.rerankScore != null && <span> · rerank score {parent.rerankScore}</span>}
        {' '}<RetrievalOrigin origin={origin} />
        {origin?.seedParentId && <span> · seed {traceChunkLabel(origin.seedParentId, chunkLabels)}</span>}
        {origin?.tableId && <span> · table {origin.tableId}</span>}
        {origin?.sectionId && <span> · section {origin.sectionId}</span>}
      </summary>
      {link && <Link to={link} className="mt-2 inline-block text-[11px] font-medium text-blue hover:underline">Inspect stored parent</Link>}
      <ChunkInspection chunk={parent} />
    </details>
  );
};

const SearchEventDetails = ({ event, chunkLabels }) => {
  const docs = Array.isArray(event.documents) ? event.documents : [];
  return (
    <div className="mt-2 space-y-2 text-[11px] text-muted">
      {event.timestamp && <time dateTime={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time>}
      {event.attempt != null && <p>Attempt {event.attempt}</p>}
      {event.query && <p>Query: <span className="mono break-words text-ink-2">{event.query}</span></p>}
      {event.type === 'retrieved_chunks' && <p>Retrieved chunks: {event.count ?? event.chunks?.length ?? 'Unavailable'}</p>}
      {event.type === 'citations' && <p>Citations supplied: {event.citations?.length ?? 'Unavailable'}</p>}
      {event.type === 'total_usage_summary' && <p>Total answer tokens: {event.totalTokens ?? 'Unavailable'} · {event.formattedTotalCost ?? 'Cost unavailable'}</p>}
      {event.intent && <p>Intent: {event.intent}</p>}
      {event.decisionSource && <p>Decision source: {event.decisionSource}</p>}
      {event.seedParentIds && <p>Seed chunks: {event.seedParentIds.map((id) => traceChunkLabel(id, chunkLabels)).join(', ') || 'None'}</p>}
      {event.addedParentIds && <p>Added chunks: {event.addedParentIds.map((id) => traceChunkLabel(id, chunkLabels)).join(', ') || 'None'}</p>}
      {event.keptParentIds && <p>Kept chunks: {event.keptParentIds.map((id) => traceChunkLabel(id, chunkLabels)).join(', ') || 'None'}</p>}
      {Array.isArray(event.decisions) && (
        <div>
          <p className="font-medium text-ink-2">Grading decisions · {event.decisions.length}</p>
          <ul className="mt-1 space-y-1">
            {event.decisions.map((decision, index) => (
              <li key={`${decision.parentId}-${index}`} className="rounded-(--radius-sm) bg-surface-2 p-2">
                {decision.parentId && decision.documentId ? (
                  <Link to={`${chunksPath(decision.documentId)}#parent-${encodeURIComponent(decision.parentId)}`} className="text-blue hover:underline">{traceChunkLabel(decision.parentId, chunkLabels, decision)}</Link>
                ) : <span>{traceChunkLabel(decision.parentId, chunkLabels, decision)}</span>}
                {' · '}{decision.relevant === true ? 'kept' : decision.relevant === false ? 'dropped' : 'decision unavailable'}
                {decision.page != null && ` · page ${decision.page}`}
                {decision.sectionId && ` · section ${decision.sectionId}`}
                <JsonDetails title="Full grading decision" value={decision} />
              </li>
            ))}
          </ul>
        </div>
      )}
      {docs.length > 0 && <p className="font-medium text-ink-2">Parent-level results · {docs.length}</p>}
      {docs.map((parent, index) => <ParentCard key={parent.id ?? index} parent={parent} chunkLabels={chunkLabels} />)}
      {typeof event.contextText === 'string' && (
        <div className="rounded-(--radius-sm) border border-border bg-surface-2 p-2">
          <div className="flex items-center justify-between gap-2"><p className="font-medium text-ink-2">Exact assembled source context</p><CopyButton text={event.contextText} label="Copy source context" /></div>
          <pre className="mono mt-2 max-h-72 overflow-auto whitespace-pre rounded-(--radius-sm) bg-surface p-2 text-[12px] text-ink-2">{event.contextText}</pre>
        </div>
      )}
      <JsonDetails title="Exact search event JSON" value={event} />
    </div>
  );
};

export default SearchEventDetails;
