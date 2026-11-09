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

  // 404 = the document left this account's roles; handled by the documents slice.
  getParentChunks: (documentId, signal) =>
    getAPI(`/documents/get-all-parent-chunk/${documentId}`, { signal, quietNotFound: true }),

  getChildChunks: (parentId, signal) =>
    getAPI(`/documents/get-all-child-chunk/${encodeURIComponent(parentId)}`, { signal, quietNotFound: true }),
};

export default documentService;
