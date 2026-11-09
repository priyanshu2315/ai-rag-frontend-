import { createSlice } from '@reduxjs/toolkit';
import {
  createRole, deleteRole, fetchLibrary, fetchRole, fetchRoles, saveRole,
} from '../actions/roleActions';
import { isCanceled } from '../createAppThunk';

/**
 * Roles (§7.1 standard shape) plus the library the role editor picks
 * documents from. `current` is the full role open in the editor; pages clear
 * it on leave so an edit never leaks into the next "new role" (§7.3).
 */
const initialState = {
  list: [],
  loaded: false,
  loading: false,
  error: null,
  current: null,
  currentLoading: false,
  currentError: null,
  saving: false,
  deletingId: null,
  library: [],
  libraryLoading: false,
  libraryError: null,
};

const summaryOf = (role) => ({
  id: role.id,
  name: role.name,
  description: role.description ?? null,
  createdAt: role.createdAt,
  updatedAt: role.updatedAt,
  documentCount: role.documents?.length ?? role.documentCount ?? 0,
  userCount: role.users?.length ?? role.userCount ?? 0,
});

/** Keeps the list in step with a role the editor just saved. */
const upsert = (state, role) => {
  if (!role?.id) return;
  const index = state.list.findIndex((item) => item.id === role.id);
  if (index === -1) state.list.unshift(summaryOf(role));
  else state.list[index] = summaryOf(role);
};

const roleSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    clearCurrentRole: (state) => {
      state.current = null;
      state.currentError = null;
      state.currentLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.list = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        if (isCanceled(action)) return;
        state.loading = false;
        state.error = action.payload?.message ?? null;
      })

      .addCase(fetchRole.pending, (state) => {
        state.currentLoading = true;
        state.currentError = null;
      })
      .addCase(fetchRole.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload ?? null;
      })
      .addCase(fetchRole.rejected, (state, action) => {
        if (isCanceled(action)) return;
        state.currentLoading = false;
        state.currentError = action.payload?.message ?? null;
      })

      .addCase(fetchLibrary.pending, (state) => {
        state.libraryLoading = true;
        state.libraryError = null;
      })
      .addCase(fetchLibrary.fulfilled, (state, action) => {
        state.libraryLoading = false;
        state.library = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchLibrary.rejected, (state, action) => {
        if (isCanceled(action)) return;
        state.libraryLoading = false;
        state.libraryError = action.payload?.message ?? null;
      })

      .addCase(createRole.pending, (state) => {
        state.saving = true;
      })
      .addCase(createRole.fulfilled, (state, action) => {
        state.saving = false;
        upsert(state, action.payload);
      })
      .addCase(createRole.rejected, (state) => {
        state.saving = false;
      })

      .addCase(saveRole.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveRole.fulfilled, (state, action) => {
        state.saving = false;
        if (action.payload) {
          state.current = action.payload;
          upsert(state, action.payload);
        }
      })
      .addCase(saveRole.rejected, (state) => {
        state.saving = false;
      })

      .addCase(deleteRole.pending, (state, action) => {
        state.deletingId = action.meta.arg;
      })
      .addCase(deleteRole.fulfilled, (state, action) => {
        state.deletingId = null;
        state.list = state.list.filter((role) => role.id !== action.meta.arg);
      })
      .addCase(deleteRole.rejected, (state) => {
        state.deletingId = null;
      });
  },
});

export const { clearCurrentRole } = roleSlice.actions;
export default roleSlice.reducer;
