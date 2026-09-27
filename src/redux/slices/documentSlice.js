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

    // The progress stream is the first to know a document finished (or
    // failed), so it writes the new status here — the chat gate reads it from
    // this list, and nothing has to refetch to unlock the composer.
    documentStatusChanged: (state, action) => {
      const doc = state.list.find((item) => item.id === action.payload.id);
      if (doc) doc.status = action.payload.status;
    },
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
        // `fresh` marks a document whose stream is opened from the very start,
        // so its tree is complete. It lives only in memory: any refetch or
        // reload drops it, which is right — after that the stream has no
        // replay and the tree can only be partial.
        if (action.payload?.id) state.list.unshift({ ...action.payload, fresh: true });
      })
      .addCase(uploadDocument.rejected, (state) => {
        state.uploading = false;
      });
  },
});

export const { clearDocuments, documentStatusChanged } = documentSlice.actions;
export default documentSlice.reducer;
