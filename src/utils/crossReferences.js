export const chunkLocation = (chunk) => {
  if (!chunk) return 'Seed context unavailable';
  const page = chunk.pageNumber ?? chunk.metadata?.page_number;
  const heading = (chunk.headingPath ?? chunk.metadata?.heading_path ?? []).join(' › ');
  const index = chunk.metadata?.chunk_index;
  return [page != null ? `Page ${page}` : null, heading || (index != null ? `Chunk ${index}` : 'Chunk')].filter(Boolean).join(': ');
};

export const observedChunks = (steps = [], chunks = []) => {
  const records = new Map();
  for (const chunk of [
    ...steps.flatMap((step) => {
      const event = step.event?.data ?? step.event ?? {};
      return [event.documents, event.chunks, event.retrievedParents, event.addedNeighbors].filter(Array.isArray).flat();
    }), ...chunks,
  ].filter((chunk) => chunk && typeof chunk === 'object' && chunk.id)) {
    const key = JSON.stringify([chunk.documentId, chunk.id]);
    const previous = records.get(key);
    records.set(key, { ...previous, ...chunk, metadata: { ...previous?.metadata, ...chunk.metadata },
      retrievalOrigin: chunk.retrievalOrigin ?? previous?.retrievalOrigin });
  }
  return [...records.values()];
};

export const referenceSeed = (origin, target, chunks = []) => {
  const matches = chunks.filter((chunk) => chunk.id === origin?.seedParentId &&
    (!target.documentId || !chunk.documentId || target.documentId === chunk.documentId));
  return matches.length === 1 ? matches[0] : null;
};

export const referenceNotice = (citation) => {
  const origin = citation.retrievalOrigin;
  if (origin?.type !== 'reference_following') return null;
  return `Retrieved via cross-reference '${origin.reference ?? 'Unspecified reference'}' · ${citation.referenceSeedLabel ?? 'Seed context unavailable'}`;
};

export const referenceDefinitionLabel = (chunk) => {
  const origin = chunk.retrievalOrigin;
  if (origin?.type !== 'reference_following') return null;
  const reference = origin.reference;
  const headings = chunk.headingPath ?? chunk.metadata?.heading_path ?? [];
  const match = typeof reference === 'string' && headings.find((heading) => heading.toLowerCase().includes(reference.toLowerCase()));
  if (match) return `🔗 Followed Definition: ${reference} (Found in ${match} Header)`;
  const text = chunk.text ?? chunk.snippet;
  if (typeof reference === 'string' && typeof text === 'string' && text.replace(/^[\s#*_]+/, '').toLowerCase().startsWith(reference.toLowerCase()))
    return `🔗 Followed Definition: ${reference} (Found at passage start)`;
  return `🔗 Followed Reference: ${reference ?? 'Unspecified reference'}${headings.length ? ` · Target heading: ${headings.join(' › ')}` : ''}`;
};

export const enrichReferenceCitation = (citation, chunks = []) => {
  const matches = chunks.filter((chunk) => chunk.id === (citation.chunkId ?? citation.id) &&
    (!citation.documentId || !chunk.documentId || citation.documentId === chunk.documentId));
  const target = matches.length === 1 ? matches[0] : citation;
  const origin = citation.retrievalOrigin ?? target.retrievalOrigin;
  return { ...citation, retrievalOrigin: origin, headingPath: citation.headingPath ?? target.headingPath ?? target.metadata?.heading_path,
    referenceSeedLabel: origin?.type === 'reference_following' ? chunkLocation(referenceSeed(origin, target, chunks)) : undefined };
};

export const followedReferences = (chunks = []) => chunks.filter((chunk) => chunk.retrievalOrigin?.type === 'reference_following')
  .map((target) => ({ target, seed: referenceSeed(target.retrievalOrigin, target, chunks), reference: target.retrievalOrigin.reference }));

export const referenceSelection = ({ seed, target }) => [seed, target].filter(Boolean).map((chunk) => JSON.stringify([chunk.documentId, chunk.id]));

export const referenceTags = (metadata = {}) => [...new Set([metadata.references, metadata.cross_references]
  .filter(Array.isArray).flat().filter((item) => typeof item === 'string' && item.trim()))];

// A document role is an indicator for review; it does not establish that an override occurred.
export const isPrecedenceItem = (chunk) => /\b(?:appendix|annex|board resolution|resolution \d{4}-\d+|memorandum|restatement)\b/i
  .test([chunk.documentTitle, chunk.metadata?.document_title, chunk.metadata?.boundaryTitle, ...(chunk.headingPath ?? chunk.metadata?.heading_path ?? [])].filter(Boolean).join(' '));
