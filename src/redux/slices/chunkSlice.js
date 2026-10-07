import { createSlice } from '@reduxjs/toolkit';
import { fetchChildChunks, fetchParentChunks } from '../actions/chunkActions';
import { deleteDocument } from '../actions/documentActions';
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
  parentResponse: null,
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
      .addCase(deleteDocument.fulfilled, (state, action) => {
        if (state.documentId === action.meta.arg) return initialState;
      })
      // Switching documents drops the previous one's chunks immediately:
      // leaving them on screen would attribute one document's text to another.
      .addCase(fetchParentChunks.pending, (state, action) => {
        if (state.documentId !== action.meta.arg) {
          state.parents = [];
          state.parentResponse = null;
          state.children = {};
          state.documentId = action.meta.arg;
        }
        state.loading = true;
        state.parentRequestId = action.meta.requestId;
        state.error = null;
      })
      .addCase(fetchParentChunks.fulfilled, (state, action) => {
        if (state.documentId !== action.meta.arg || state.parentRequestId !== action.meta.requestId) return;
        state.loading = false;
        const parents = Array.isArray(action.payload) ? action.payload : [];
        if (parents.some((parent) => parent.documentId !== state.documentId)) {
          state.parents = [];
          state.parentResponse = null;
          state.error = 'The returned parents do not belong to this document.';
          return;
        }
        state.parents = parents;
        state.parentResponse = action.payload;
      })
      .addCase(fetchParentChunks.rejected, (state, action) => {
        if (state.documentId !== action.meta.arg || state.parentRequestId !== action.meta.requestId) return;
        if (isCanceled(action)) { state.loading = false; return; }
        state.loading = false;
        state.error = action.payload?.message ?? null;
      })

      // Per-parent, so only the row being expanded shows a spinner (§12).
      .addCase(fetchChildChunks.pending, (state, action) => {
        state.children[action.meta.arg] = { requestId: action.meta.requestId, loading: true, error: null, notFound: false, items: [] };
      })
      .addCase(fetchChildChunks.fulfilled, (state, action) => {
        if (state.children[action.meta.arg]?.requestId !== action.meta.requestId) return;
        const children = action.payload?.children;
        if (action.payload?.documentId !== state.documentId ||
          action.payload?.parentId !== action.meta.arg ||
          action.payload?.parent?.documentId !== state.documentId ||
          !Array.isArray(children) || children.some((child) =>
            child.documentId !== state.documentId || child.parentId !== action.meta.arg)) {
          state.children[action.meta.arg] = {
            loading: false, error: 'The returned parent does not belong to this document.',
            notFound: false, items: [], totalChildren: null,
          };
          return;
        }
        state.children[action.meta.arg] = {
          loading: false,
          error: null,
          notFound: false,
          items: children,
          totalChildren: action.payload?.totalChildren ?? null,
          response: action.payload,
        };
        const index = state.parents.findIndex((parent) => parent.id === action.meta.arg);
        if (index !== -1) state.parents[index] = action.payload.parent;
      })
      .addCase(fetchChildChunks.rejected, (state, action) => {
        if (state.children[action.meta.arg]?.requestId !== action.meta.requestId) return;
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
