import createAppThunk from '../createAppThunk';
import documentService from '../../services/documentService';

export const fetchDocuments = createAppThunk('documents/fetch', (_arg, { signal }) =>
  documentService.getMyDocuments(signal)
);

export const uploadDocument = createAppThunk('documents/upload', (file, { signal }) =>
  documentService.upload(file, { signal })
);

export const replaceDocument = createAppThunk('documents/replace', ({ id, file }, { signal }) =>
  documentService.replace(id, file, { signal })
);

export const fetchDocumentChanges = createAppThunk('documents/changes', ({ documentId, version }, { signal }) =>
  documentService.getChanges(documentId, version, signal)
);

export const deleteDocument = createAppThunk('documents/delete', (documentId, { signal }) =>
  documentService.remove(documentId, signal)
);
