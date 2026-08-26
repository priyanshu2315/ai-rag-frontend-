import { getAPI, uploadAPI } from './api';

const documentService = {
  getMyDocuments: (signal) => getAPI('/documents/my-documents', { signal }),

  upload: (file, { signal, onUploadProgress } = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    return uploadAPI('/documents/upload', formData, { signal, onUploadProgress });
  },
};

export default documentService;
