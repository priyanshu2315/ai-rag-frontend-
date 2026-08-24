import api from './axios';

export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
};

export const documentApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getMyDocuments: () => api.get('/documents/my-documents'),
};

export const chatApi = {
  sendMessage: (question: string, documentId: string | null) =>
    api.post('/chat', { question, documentId }),
};
