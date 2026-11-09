import { createSlice } from '@reduxjs/toolkit';
import { fetchPipeline } from '../actions/pipelineActions';
import { isCanceled } from '../createAppThunk';
import { normalizePipeline } from '../../utils/pipelineTimeline';

/**
 * The About page's engineering timeline. Not persisted (§7.1): it is kept for
 * the session only, so revisiting the page does not refetch, and a reload
 * does. `requestId` keeps a superseded request — StrictMode's first mount, or
 * one aborted on unmount — from writing over the one in flight.
 */
const initialState = {
  phases: [],
  total: 0,
  status: 'idle',
  error: null,
  requestId: null,
};

const pipelineSlice = createSlice({
  name: 'pipeline',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPipeline.pending, (state, action) => {
        state.requestId = action.meta.requestId;
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchPipeline.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        const { phases, total } = normalizePipeline(action.payload);
        state.phases = phases;
        state.total = total;
        state.status = 'succeeded';
      })
      .addCase(fetchPipeline.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        // Leaving the page mid-request is not a failure; the next visit retries.
        if (isCanceled(action)) {
          state.status = state.phases.length ? 'succeeded' : 'idle';
          return;
        }
        state.status = 'failed';
        state.error = action.payload?.message ?? null;
      });
  },
});

export default pipelineSlice.reducer;
