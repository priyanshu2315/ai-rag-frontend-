import { createSlice } from '@reduxjs/toolkit';
import { deleteDocument, fetchDocuments, uploadDocument } from '../actions/documentActions';
import { isCanceled } from '../createAppThunk';
import { DOCUMENT_STATUS, SUMMARY_STATUS } from '../../constants/documentStatus';
import { createInitialProgress, progressReducer } from '../../utils/progressReducer';

const summaryRank = { PENDING: 0, PROCESSING: 1, COMPLETED: 2, FAILED: 2 };

const mergeDocument = (incoming, current) => {
  if (!current) return incoming;
  const status = current.status && current.status !== DOCUMENT_STATUS.PROCESSING
    ? current.status : incoming.status;
  const summaryStatus = (summaryRank[current.summaryStatus] ?? -1) >=
    (summaryRank[incoming.summaryStatus] ?? -1) ? current.summaryStatus : incoming.summaryStatus;
  return { ...current, ...incoming, status, summaryStatus };
};

const stateFromEvent = (event) => {
  const next = {
    status: event.status ?? event.data?.status,
    summaryStatus: event.summaryStatus ?? event.data?.summaryStatus,
  };
  if (event.type === 'chunks_ready') {
    next.status = DOCUMENT_STATUS.COMPLETED;
    next.summaryStatus ??= SUMMARY_STATUS.PENDING;
  } else if (event.type === 'summarizing') {
    next.status = DOCUMENT_STATUS.COMPLETED;
    next.summaryStatus = SUMMARY_STATUS.PROCESSING;
  } else if (event.type === 'completed') {
    next.status = DOCUMENT_STATUS.COMPLETED;
    next.summaryStatus = SUMMARY_STATUS.COMPLETED;
  } else if (event.type === 'summary_failed') {
    next.status = DOCUMENT_STATUS.COMPLETED;
    next.summaryStatus = SUMMARY_STATUS.FAILED;
  } else if (event.type === 'failed') {
    next.status = DOCUMENT_STATUS.FAILED;
  }
  return next;
};

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
  progressById: {},
  loaded: false,
  loading: false,
  uploading: false,
  deletingId: null,
  deleteError: null,
  // A list request started before deletion must not restore a deleted row.
  deletedIds: [],
  error: null,
};

const documentSlice = createSlice({
  name: 'documents',
  initialState,
  reducers: {
    clearDocuments: () => initialState,
    clearDeleteError: (state) => {
      state.deleteError = null;
    },

    // The progress stream is the first to know a document finished (or
    // failed), so it writes the new status here — the chat gate reads it from
    // this list, and nothing has to refetch to unlock the composer.
    documentProgressChanged: (state, action) => {
      const { id, progressAction } = action.payload;
      if (progressAction.event?.documentId && progressAction.event.documentId !== id) return;
      state.progressById[id] = progressReducer(
        state.progressById[id] ?? createInitialProgress(), progressAction
      );
      if (progressAction.type !== 'event') return;
      const doc = state.list.find((item) => item.id === id);
      if (!doc) return;
      const next = stateFromEvent(progressAction.event);
      if (next.status && (doc.status === DOCUMENT_STATUS.PROCESSING || doc.status === next.status)) {
        doc.status = next.status;
      }
      if (next.summaryStatus &&
        (summaryRank[next.summaryStatus] ?? -1) > (summaryRank[doc.summaryStatus] ?? -1)) {
        doc.summaryStatus = next.summaryStatus;
      }
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
        state.list = Array.isArray(action.payload)
          ? action.payload.filter((doc) => !state.deletedIds.includes(doc.id))
            .map((doc) => mergeDocument(doc, state.list.find((item) => item.id === doc.id)))
          : [];
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
        // for session provenance, not a guarantee of complete history. Any refetch or
        // reload drops it, which is right — after that the stream has no
        // replay and the tree can only be partial.
        if (action.payload?.id) state.list.unshift({
          ...action.payload,
          filename: action.payload.filename ?? action.meta.arg.name,
          fresh: true,
        });
      })
      .addCase(uploadDocument.rejected, (state) => {
        state.uploading = false;
      })

      .addCase(deleteDocument.pending, (state, action) => {
        state.deletingId = action.meta.arg;
        state.deleteError = null;
      })
      .addCase(deleteDocument.fulfilled, (state, action) => {
        const id = action.meta.arg;
        state.deletingId = null;
        state.list = state.list.filter((doc) => doc.id !== id);
        delete state.progressById[id];
        if (!state.deletedIds.includes(id)) state.deletedIds.push(id);
      })
      .addCase(deleteDocument.rejected, (state, action) => {
        state.deletingId = null;
        if (isCanceled(action)) return;
        // Keep the document available for retry, including partial server failures.
        state.deleteError = action.payload?.message ?? 'Could not delete the document. Please try again.';
      });
  },
});

export const { clearDocuments, clearDeleteError, documentProgressChanged } = documentSlice.actions;
export default documentSlice.reducer;
