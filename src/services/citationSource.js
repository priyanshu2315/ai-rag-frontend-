import documentService from './documentService';

/** The existing child endpoint returns its saved parent; fetch only when a citation is opened. */
export const loadCitationParent = async (citation, { signal, documentId } = {}) => {
  const parentId = citation?.chunkId ?? citation?.sourceId;
  if (!parentId || parentId === 'Source ID' || /^Page\s+\d/i.test(parentId)) return null;
  const response = await documentService.getChildChunks(parentId, signal);
  const parent = response?.parent;
  if (parent?.id !== parentId || (documentId && parent.documentId && parent.documentId !== documentId) ||
    (citation.documentId && parent.documentId && parent.documentId !== citation.documentId) ||
    (citation.documentTitle && parent.metadata?.document_title && parent.metadata.document_title !== citation.documentTitle)) {
    throw new Error('The saved source does not match this citation.');
  }
  return parent;
};
