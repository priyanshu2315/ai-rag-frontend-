import { createSlice } from '@reduxjs/toolkit';
import { fetchDocuments, uploadDocument } from '../actions/documentActions';
import { isCanceled } from '../createAppThunk';

/** `activeId: null` is the real default — it means "search all documents". */
const initialState = {
  list: [],
  activeId: null,
  loading: false,
  uploading: false,
  error: null,
};

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    setActiveDocument: (state, action) => {
      state.activeId = action.payload;
    },
    clearDocuments: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocuments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocuments.fulfilled, (state, action) => {
        state.loading = false;
        state.list = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchDocuments.rejected, (state, action) => {
        state.loading = false;
        // A cancelled fetch must never blank the list or raise an error (§7.2).
        if (isCanceled(action)) return;
        state.error = action.payload?.message ?? null;
      })

      .addCase(uploadDocument.pending, (state) => {
        state.uploading = true;
      })
      .addCase(uploadDocument.fulfilled, (state, action) => {
        state.uploading = false;
        if (action.payload?.id) state.list.unshift(action.payload);
      })
      .addCase(uploadDocument.rejected, (state) => {
        state.uploading = false;
      });
  },
});

export const { setActiveDocument, clearDocuments } = documentSlice.actions;
export default documentSlice.reducer;
