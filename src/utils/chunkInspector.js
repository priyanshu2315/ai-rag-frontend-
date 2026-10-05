const numericIndex = (value) => {
  const number = Number(value);
  return value === null || value === undefined || value === '' || !Number.isFinite(number)
    ? Number.POSITIVE_INFINITY : number;
};

export const sortByMetadataIndex = (items, key) => [...items].sort((a, b) =>
  numericIndex(a.metadata?.[key]) - numericIndex(b.metadata?.[key])
);

export const pagesOf = (metadata = {}) => {
  const pages = Array.isArray(metadata.source_pages) ? [...metadata.source_pages] : [];
  if (metadata.page_number !== null && metadata.page_number !== undefined) {
    pages.push(metadata.page_number);
  }
  return [...new Set(pages.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
};

export const sectionKey = (documentId, sectionId) =>
  JSON.stringify([documentId, sectionId]);

/** Sections are groups of parent metadata, not a separate backend resource. */
export const groupSections = (parents, documentId) => {
  const groups = new Map();
  for (const parent of sortByMetadataIndex(parents, 'chunk_index')) {
    const sectionId = parent.metadata?.section_id ?? null;
    // Missing IDs cannot establish that two parents belong to one section.
    const key = sectionKey(documentId, sectionId ?? `unknown-parent:${parent.id}`);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        sectionId,
        headingPath: parent.metadata?.heading_path ?? null,
        parents: [],
        pages: [],
      });
    }
    const group = groups.get(key);
    group.parents.push(parent);
    group.pages = [...new Set([...group.pages, ...pagesOf(parent.metadata)])].sort((a, b) => a - b);
  }
  return [...groups.values()];
};

export const matchesChunkSearch = (parent, entry, query) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const matches = (item) => `${item.id ?? ''}\n${item.text ?? ''}\n${item.searchText ?? ''}`.toLowerCase().includes(needle);
  return matches(parent) || entry?.items?.some(matches) || false;
};
