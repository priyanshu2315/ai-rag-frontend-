/** Resolve display indexes from observed records; database IDs remain navigation keys. */
export const traceChunkLabels = (steps = []) => {
  const records = new Map();
  for (const step of steps) {
    const event = step.event?.data ?? step.event;
    if (!event) continue;
    const chunks = [event.documents, event.chunks, event.retrievedParents, event.addedNeighbors, event.decisions, event.gradingDecisions];
    for (const list of chunks.filter(Array.isArray)) {
      for (const chunk of list) {
        if (!chunk || typeof chunk !== 'object') continue;
        const id = chunk.id ?? chunk.parentId;
        if (!id) continue;
        const previous = records.get(id);
        const index = chunk.metadata?.chunk_index;
        records.set(id, { index: Number.isInteger(index) ? index : previous?.index,
          title: chunk.metadata?.document_title ?? chunk.documentTitle ?? previous?.title });
      }
    }
  }
  return new Map([...records].map(([id, record]) => [id,
    `${record.index == null ? 'Chunk (index unavailable)' : `Chunk ${record.index}`}${record.title ? ` · ${record.title}` : ''}`]));
};

export const traceChunkLabel = (id, labels, chunk) => {
  if (id && labels?.has(id)) return labels.get(id);
  const index = chunk?.metadata?.chunk_index;
  return Number.isInteger(index) ? `Chunk ${index}` : 'Chunk (index unavailable)';
};

export const readableTraceText = (text, labels) => {
  if (typeof text !== 'string') return text;
  let result = text;
  for (const [id, label] of [...(labels ?? [])].sort(([a], [b]) => b.length - a.length)) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, 'g'), () => label);
  }
  // A status can arrive before its chunk metadata. Do not expose an unreadable UUID meanwhile.
  return result.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'Chunk (index unavailable)');
};
