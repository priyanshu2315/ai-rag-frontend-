import { createSlice } from '@reduxjs/toolkit';
import { deleteDocument, fetchDocumentChanges } from '../actions/documentActions';
import { isCanceled } from '../createAppThunk';

/**
 * The What changed page's data: one document version's changes at a time.
 *
 * `request` remembers what was asked for — `version` is null when the URL had
 * none and the backend picked the latest — so the page can tell "this answer
 * is for what I am showing" from a response that arrived for an older URL.
 */
const initialState = {
  request: null, // { documentId, version }
  requestId: null,
  data: null,
  loading: false,
  error: null,
};

const changesSlice = createSlice({
  name: 'changes',
  initialState,
  reducers: {
    clearChanges: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDocumentChanges.pending, (state, action) => {
        const { documentId, version } = action.meta.arg;
        // Another document: drop the old one at once rather than show its
        // changes under this document's name.
        if (state.request?.documentId !== documentId) state.data = null;
        state.request = { documentId, version: version ?? null };
        state.requestId = action.meta.requestId;
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDocumentChanges.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        const data = action.payload;
        state.data = data && data.documentId === action.meta.arg.documentId
          ? { ...data, changes: Array.isArray(data.changes) ? data.changes : [] }
          : null;
        if (!state.data) state.error = 'The returned changes do not belong to this document.';
      })
      .addCase(fetchDocumentChanges.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        if (isCanceled(action)) return;
        state.data = null;
        state.error = action.payload?.message ?? 'Could not load the changes. Please try again.';
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        if (state.request?.documentId === action.meta.arg) return initialState;
        return undefined;
      });
  },
});

export const { clearChanges } = changesSlice.actions;
export default changesSlice.reducer;
