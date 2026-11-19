import { deleteAPI, getAPI, uploadAPI } from './api';

const documentService = {
  /** Documents this account can access: all for an admin, the roles' for a user. */
  getMyDocuments: (signal) => getAPI('/documents/my-documents', { signal }),

  /** The whole library — admin only. Feeds the role document picker. */
  getLibrary: (signal) => getAPI('/documents', { signal }),

  remove: (documentId, signal) => deleteAPI(`/documents/${documentId}`, { signal }),

  upload: (file, { signal, onUploadProgress } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadAPI('/documents/upload', formData, { signal, onUploadProgress });
  },

  /**
   * A new version onto the same document (same id, roles and chats) — admin
   * only, PDF only. Answers `{ changed: false, reason }` (200) when the text is
   * the same, or `{ changed: true, version, diff }` (202) when it is queued.
   */
  replace: (documentId, file, { signal } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadAPI(`/documents/${documentId}`, formData, { method: 'put', signal });
  },

  /**
   * What changed in `version` (2..current; omitted = latest) against the
   * version before it. The page shows 400/500 text inline; a 404 (gone, or no
   * access) drops the document like every other document-scoped 404.
   */
  getChanges: (documentId, version, signal) =>
    getAPI(`/documents/${documentId}/changes`, {
      params: version ? { version } : undefined,
      signal,
      silentStatuses: [400, 404, 500],
    }),

  // 404 = the document left this account's roles; handled by the documents slice.
  getParentChunks: (documentId, signal) =>
    getAPI(`/documents/get-all-parent-chunk/${documentId}`, { signal, quietNotFound: true }),

  getChildChunks: (parentId, signal) =>
    getAPI(`/documents/get-all-child-chunk/${encodeURIComponent(parentId)}`, { signal, quietNotFound: true }),
};

export default documentService;
