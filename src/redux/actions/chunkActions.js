import createAppThunk from '../createAppThunk';
import documentService from '../../services/documentService';

export const fetchParentChunks = createAppThunk('chunks/fetchParents', (documentId, { signal }) =>
  documentService.getParentChunks(documentId, signal)
);

export const fetchChildChunks = createAppThunk('chunks/fetchChildren', (parentId, { signal }) =>
  documentService.getChildChunks(parentId, signal)
);
