import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Document } from '../../types';

interface DocumentState {
  documents: Document[];
  activeDocumentId: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: DocumentState = {
  documents: [],
  activeDocumentId: null, // null means "Search All Documents"
  loading: false,
  error: null,
};

const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setDocuments: (state, action: PayloadAction<Document[]>) => {
      state.documents = action.payload;
    },
    addDocument: (state, action: PayloadAction<Document>) => {
      state.documents.unshift(action.payload);
    },
    setActiveDocumentId: (state, action: PayloadAction<string | null>) => {
      state.activeDocumentId = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setDocuments,
  addDocument,
  setActiveDocumentId,
  setLoading,
  setError,
} = documentSlice.actions;

export default documentSlice.reducer;
