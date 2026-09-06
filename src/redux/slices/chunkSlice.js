import { createSlice } from '@reduxjs/toolkit';
import { fetchChildChunks, fetchParentChunks } from '../actions/chunkActions';
import { isCanceled } from '../createAppThunk';

/**
 * The chunk explorer's data (§7.1) — parents for the document in the URL, and
 * the children of every parent that has been expanded at least once.
 *
 * `children` is keyed by parent id and doubles as the cache the spec asks for:
 * an entry existing at all is what tells the hook not to refetch, so a
 * cancelled request deletes its entry rather than leaving a half-loaded one
 * that would never be retried.
 */
const initialState = {
  documentId: null,
  parents: [],
  loading: false,
  error: null,
  children: {},
};

const chunkSlice = createSlice({
  name: 'chunks',
  initialState,
  reducers: {
    clearChunks: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      // Switching documents drops the previous one's chunks immediately:
      // leaving them on screen would attribute one document's text to another.
      .addCase(fetchParentChunks.pending, (state, action) => {
        if (state.documentId !== action.meta.arg) {
          state.parents = [];
          state.children = {};
          state.documentId = action.meta.arg;
        }
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParentChunks.fulfilled, (state, action) => {
        state.loading = false;
        state.parents = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchParentChunks.rejected, (state, action) => {
        if (isCanceled(action)) return;
        state.loading = false;
        state.error = action.payload?.message ?? null;
      })

      // Per-parent, so only the row being expanded shows a spinner (§12).
      .addCase(fetchChildChunks.pending, (state, action) => {
        state.children[action.meta.arg] = { loading: true, error: null, notFound: false, items: [] };
      })
      .addCase(fetchChildChunks.fulfilled, (state, action) => {
        const children = action.payload?.children;
        state.children[action.meta.arg] = {
          loading: false,
          error: null,
          notFound: false,
          items: Array.isArray(children) ? children : [],
        };
      })
      .addCase(fetchChildChunks.rejected, (state, action) => {
        if (isCanceled(action)) {
          delete state.children[action.meta.arg];
          return;
        }
        state.children[action.meta.arg] = {
          loading: false,
          // A 404 means the parent id itself is unknown, which reads to the
          // user as "nothing to show here" rather than as a failure.
          notFound: action.payload?.status === 404,
          error: action.payload?.message ?? null,
          items: [],
        };
      });
  },
});

export const { clearChunks } = chunkSlice.actions;
export default chunkSlice.reducer;
