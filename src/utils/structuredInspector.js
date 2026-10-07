// All maps belong to one document/session. Unknown payload fields stay in the timeline.
export const emptyStructure = () => ({ sources: {}, headings: {}, sections: {}, parts: {},
  parents: {}, children: {}, identity: null, chunkerVersion: null, totalSources: null,
  totalPages: null, relationships: [], references: [], warnings: [], diagnostics: [],
  saved: false, searchable: false, summary: 'PENDING', savedCounts: null });

export const mergeChunk = (previous = {}, incoming = {}) => {
  const supplied = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value !== undefined));
  const metadata = { ...previous.metadata, ...incoming.metadata };
  // Preparation events must not remove completed embedding measurements.
  if (previous.metadata?.embedding) metadata.embedding = { ...incoming.metadata?.embedding, ...previous.metadata.embedding };
  return { ...previous, ...supplied, metadata,
    ...((previous.embeddingDetails || incoming.embeddingDetails) && { embeddingDetails: { ...previous.embeddingDetails, ...incoming.embeddingDetails } }),
    ...(previous.embeddingStage === 'embedded in memory' && { embeddingStage: previous.embeddingStage }) };
};

export const applyStructureEvent = (current, event) => {
  const next = { ...current };
  const parent = (record) => {
    if (record?.id) next.parents = { ...next.parents, [record.id]: mergeChunk(next.parents[record.id], record) };
  };
  const child = (record) => {
    if (record?.id) next.children = { ...next.children, [record.id]: mergeChunk(next.children[record.id], record) };
  };
  if (event.totalSources != null) next.totalSources = event.totalSources;
  if (event.totalPages != null) next.totalPages = event.totalPages;
  if (event.type === 'page_extracted') {
    const key = event.source?.id ?? `page:${event.page}`;
    next.sources = { ...next.sources, [key]: event };
  }
  if (event.type === 'document_identity') next.identity = event.identity;
  if (event.type === 'heading_decision' && event.decision?.id)
    next.headings = { ...next.headings, [event.decision.id]: event.decision };
  if (['section', 'section_part'].includes(event.type)) {
    next.sections = { ...next.sections, [event.sectionId]: { ...next.sections[event.sectionId], ...event } };
    if (event.type === 'section_part') next.parts = { ...next.parts, [`${event.sectionId}:${event.partIndex}`]: event };
  }
  if (event.type === 'chunking_start') next.chunkerVersion = event.chunkerVersion;
  if (event.type === 'chunking_complete') {
    next.sections = { ...next.sections };
    for (const section of event.sections ?? []) next.sections[section.id] = { ...next.sections[section.id], ...section };
  }
  if (event.type === 'structure_resolved') {
    next.relationships = event.tableContinuations ?? [];
    next.references = event.references ?? [];
  }
  if (event.type === 'parent_created') parent(event.parent);
  if (event.type === 'parent') parent({ id: event.parentId, documentId: event.documentId,
    text: event.text, searchText: event.searchText, metadata: event.metadata,
    prevParentId: event.prevParentId, nextParentId: event.nextParentId, totalChildren: event.totalChildren });
  if (event.type === 'parent_links') parent({ id: event.parentId, prevParentId: event.prevParentId, nextParentId: event.nextParentId });
  if (event.type === 'child_created') child(event.child);
  if (event.type === 'child') child({ id: event.childId, parentId: event.parentId,
    documentId: event.documentId, text: event.text, searchText: event.searchText,
    metadata: event.metadata, embeddingDetails: event.embeddingDetails, embeddingStage: 'embedded in memory' });
  if (['chunking_failed', 'embedding_failed'].includes(event.type)) next.diagnostics = [...next.diagnostics, event];
  if (event.type === 'chunks_saved') { next.saved = true; next.savedCounts = { parents: event.totalParents, children: event.totalChildren }; }
  if (['chunks_ready', 'summarizing', 'completed', 'summary_failed'].includes(event.type)) { next.saved = true; next.searchable = true; }
  if (event.type === 'summarizing' && !['COMPLETED', 'FAILED'].includes(next.summary)) next.summary = 'PROCESSING';
  if (event.type === 'completed') next.summary = 'COMPLETED';
  if (event.type === 'summary_failed') next.summary = 'FAILED';
  next.warnings = [...new Set([...next.warnings, ...(event.warnings ?? [])])];
  return next;
};

export const headingTree = (decisions) => {
  const nodes = new Map(decisions.map((decision) => [decision.id, { ...decision, children: [] }]));
  const roots = [];
  for (const node of nodes.values()) {
    let cursor = node;
    const seen = new Set([node.id]);
    let cycle = false;
    while (cursor.parentCandidateId && nodes.has(cursor.parentCandidateId)) {
      if (seen.has(cursor.parentCandidateId)) { cycle = true; break; }
      seen.add(cursor.parentCandidateId);
      cursor = nodes.get(cursor.parentCandidateId);
    }
    const parent = nodes.get(node.parentCandidateId);
    if (parent && !cycle) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
};

export const structureGroups = (chunks, documentId, field) => {
  const groups = new Map();
  for (const chunk of chunks) {
    if (chunk.documentId && chunk.documentId !== documentId) continue;
    for (const id of new Set(chunk.metadata?.[field] ?? [])) {
      const key = JSON.stringify([documentId, id]);
      if (!groups.has(key)) groups.set(key, { key, id, chunks: [] });
      groups.get(key).chunks.push(chunk);
    }
  }
  return [...groups.values()];
};

export const uniqueEvidence = (records) => [...new Map(records.map((record) => [JSON.stringify(record), record])).values()];
