import { createSlice } from '@reduxjs/toolkit';
import { fetchDocuments, uploadDocument } from '../actions/documentActions';
import { isCanceled } from '../createAppThunk';

/**
 * No `activeId` here: the selected document is the URL (§14), and keeping a
 * second copy in the store would only give the two a chance to disagree.
 *
 * `loaded` distinguishes "no documents" from "not fetched yet" — without it an
 * unknown id in the URL cannot be told apart from one that simply has not been
 * checked against the list yet.
 */
const initialState = {
  list: [],
  loaded: false,
  loading: false,
  uploading: false,
  error: null,
};

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
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
        state.loaded = true;
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

export const { clearDocuments } = documentSlice.actions;
export default documentSlice.reducer;
