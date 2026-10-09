import { mergeChunk } from './structuredInspector.js';
import { pagesOf, sectionKey, sortByMetadataIndex } from './chunkInspector.js';

export const buildSourcePages = (events) => {
  const sources = new Map();
  for (const event of events) {
    if (!['page_extracted', 'page_transcribed', 'page_corrected', 'heading_detected', 'code_fence', 'heading_decision'].includes(event.type)) continue;
    const key = event.source?.id ?? event.sourceId ?? (event.page != null ? `page:${event.page}` : null);
    if (!key) continue;
    if (!sources.has(key)) sources.set(key, { id: key, number: event.page ?? null, text: null, textLength: null, headings: [], fences: [], source: event.source });
    const source = sources.get(key);
    if (event.type === 'page_extracted') Object.assign(source, { text: event.text ?? null, textLength: event.textLength ?? null, parserItemCount: event.parserItemCount ?? null, source: event.source, number: event.page ?? null });
    if (['page_transcribed', 'page_corrected'].includes(event.type)) Object.assign(source, {
      text: event.text ?? event.correctedText ?? null, originalText: event.originalText,
      textLength: (event.text ?? event.correctedText)?.length ?? null,
      source: event.source ?? source.source ?? { id: key }, number: event.page ?? null,
    });
    if (['heading_detected', 'heading_decision'].includes(event.type)) source.headings.push(event);
    if (event.type === 'code_fence') source.fences.push(event);
  }
  return [...sources.values()].sort((a, b) => (a.source?.sequenceIndex ?? a.number ?? Infinity) - (b.source?.sequenceIndex ?? b.number ?? Infinity));
};

/** Merge live preparation events by real section, parent and child IDs. */
export const buildLiveSections = (events, documentId) => {
  const sections = new Map();
  const ensureSection = (sectionId, fallbackId) => {
    const key = sectionKey(documentId, sectionId ?? `unknown-parent:${fallbackId}`);
    if (!sections.has(key)) sections.set(key, {
      key, sectionId: sectionId ?? null, headingPath: null, pages: [], parts: new Map(),
      parents: new Map(), totalParents: null, totalChildren: null,
    });
    return sections.get(key);
  };
  const addPage = (section, page) => {
    if (page != null && !section.pages.includes(Number(page))) section.pages.push(Number(page));
  };
  const upsertParent = (record, sectionId = record.metadata?.section_id) => {
    if (!record?.id) return null;
    const section = ensureSection(sectionId, record.id);
    const existing = findParent(record.id);
    if (existing && existing.section !== section) {
      existing.section.parents.delete(record.id);
      section.parents.set(record.id, existing.parent);
    }
    const previous = section.parents.get(record.id) ?? { id: record.id, children: new Map() };
    const supplied = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
    section.parents.set(record.id, { ...mergeChunk(previous, supplied), children: previous.children });
    section.headingPath ??= record.metadata?.heading_path ?? null;
    pagesOf(record.metadata).forEach((page) => addPage(section, page));
    return { section, parent: section.parents.get(record.id) };
  };
  const findParent = (id) => {
    for (const section of sections.values()) {
      if (section.parents.has(id)) return { section, parent: section.parents.get(id) };
    }
    return null;
  };
  const upsertChild = (record, sectionId = record.metadata?.section_id) => {
    if (!record?.id || !record.parentId) return;
    const match = findParent(record.parentId) ?? upsertParent({ id: record.parentId }, sectionId);
    if (!match) return;
    const previous = match.parent.children.get(record.id) ?? { id: record.id };
    const supplied = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
    match.parent.children.set(record.id, mergeChunk(previous, supplied));
    match.section.headingPath ??= record.metadata?.heading_path ?? null;
    pagesOf(record.metadata).forEach((page) => addPage(match.section, page));
  };

  for (const event of events) {
    if (event.documentId && event.documentId !== documentId) continue;
    switch (event.type) {
      case 'section': {
        const section = ensureSection(event.sectionId, event.eventId);
        section.headingPath = event.headingPath ?? section.headingPath;
        section.structure = event.structure ?? section.structure;
        addPage(section, event.page);
        break;
      }
      case 'section_part': {
        const section = ensureSection(event.sectionId, event.eventId);
        section.headingPath = event.headingPath ?? section.headingPath;
        section.structure = event.structure ?? section.structure;
        addPage(section, event.page);
        section.parts.set(`${event.sectionId}:${event.partIndex}`, event);
        break;
      }
      case 'chunking_complete':
        for (const item of event.sections ?? []) {
          const section = ensureSection(item.id, item.id);
          section.headingPath = item.headingPath ?? section.headingPath;
          section.structure = item.structure ?? section.structure;
          section.totalParents = item.totalParents ?? section.totalParents;
          section.totalChildren = item.totalChildren ?? section.totalChildren;
          (item.sourcePages ?? []).forEach((page) => addPage(section, page));
        }
        break;
      case 'parent_created':
        upsertParent(event.parent);
        break;
      case 'parent':
        upsertParent({
          id: event.parentId, documentId, text: event.text, searchText: event.searchText,
          metadata: event.metadata, prevParentId: event.prevParentId,
          nextParentId: event.nextParentId, totalChildren: event.totalChildren,
        }, event.sectionId);
        break;
      case 'parent_links': {
        const match = findParent(event.parentId) ?? upsertParent({ id: event.parentId }, event.sectionId);
        if (match) Object.assign(match.parent, {
          prevParentId: event.prevParentId, nextParentId: event.nextParentId,
        });
        break;
      }
      case 'child_created':
        upsertChild(event.child);
        break;
      case 'child':
        upsertChild({
          id: event.childId, parentId: event.parentId, documentId,
          text: event.text, searchText: event.searchText, metadata: event.metadata,
          embeddingDetails: event.embeddingDetails, embeddingStage: 'embedded in memory',
        });
        break;
      case 'embedding_start':
        upsertChild({ id: event.childId, parentId: event.parentId, searchText: event.searchText,
          embeddingStage: 'embedding in memory' });
        break;
      case 'embedding_failed':
        upsertChild({ id: event.childId, parentId: event.parentId,
          embeddingDetails: event.embeddingDetails, embeddingStage: 'embedding failed',
          embeddingError: event.message });
        break;
      default:
        break;
    }
  }

  return [...sections.values()].map((section) => ({
    ...section,
    pages: [...section.pages].sort((a, b) => a - b),
    parts: [...section.parts.values()].sort((a, b) => a.page - b.page || a.partIndex - b.partIndex),
    parents: sortByMetadataIndex([...section.parents.values()], 'chunk_index').map((parent) => ({
      ...parent,
      children: sortByMetadataIndex([...parent.children.values()], 'child_index'),
    })),
  }));
};

/** REST records replace preparation records; live-only empty sections remain visible. */
export const combineInspectorSections = (savedSections, liveSections, chunksReady) => {
  const combined = new Map(liveSections.map((section) => [section.key, {
    ...section,
    parents: chunksReady ? [] : section.parents,
    saved: false,
  }]));
  for (const saved of savedSections) {
    const live = combined.get(saved.key);
    combined.set(saved.key, {
      ...live,
      ...saved,
      pages: [...new Set([...(live?.pages ?? []), ...saved.pages])].sort((a, b) => a - b),
      parts: live?.parts ?? [],
      totalParents: live?.totalParents ?? saved.parents.length,
      totalChildren: live?.totalChildren ?? (saved.parents.every((item) => item.totalChildren != null)
        ? saved.parents.reduce((sum, item) => sum + item.totalChildren, 0) : null),
      saved: true,
    });
  }
  return [...combined.values()];
};
