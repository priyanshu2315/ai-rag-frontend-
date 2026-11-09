import { createSlice } from '@reduxjs/toolkit';
import {
  createUser, fetchUser, fetchUsers, resetUserPassword, saveUser, setUserActive,
} from '../actions/userActions';
import { isCanceled } from '../createAppThunk';
import { splitEmailResult } from '../../utils/users';

/**
 * Accounts (§7.1 standard shape). The search query is the URL's, not the
 * store's (§6) — this holds only what the server returned for it.
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
  /** The row whose enable/disable or password reset is in flight. */
  actingId: null,
};

const replace = (state, user) => {
  if (!user?.id) return;
  const index = state.list.findIndex((item) => item.id === user.id);
  if (index !== -1) state.list[index] = user;
  if (state.current?.id === user.id) state.current = user;
};

const userSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    clearCurrentUser: (state) => {
      state.current = null;
      state.currentError = null;
      state.currentLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.list = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        // A search superseded by the next keystroke is not a failure (§6).
        if (isCanceled(action)) return;
        state.loading = false;
        state.error = action.payload?.message ?? null;
      })

      .addCase(fetchUser.pending, (state) => {
        state.currentLoading = true;
        state.currentError = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.currentLoading = false;
        state.current = action.payload ?? null;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        if (isCanceled(action)) return;
        state.currentLoading = false;
        state.currentError = action.payload?.message ?? null;
      })

      .addCase(createUser.pending, (state) => {
        state.saving = true;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.saving = false;
        const { user } = splitEmailResult(action.payload);
        if (user?.id) state.list.unshift(user);
      })
      .addCase(createUser.rejected, (state) => {
        state.saving = false;
      })

      .addCase(saveUser.pending, (state) => {
        state.saving = true;
      })
      .addCase(saveUser.fulfilled, (state, action) => {
        state.saving = false;
        replace(state, action.payload);
      })
      .addCase(saveUser.rejected, (state) => {
        state.saving = false;
      })

      .addCase(setUserActive.pending, (state, action) => {
        state.actingId = action.meta.arg.id;
      })
      .addCase(setUserActive.fulfilled, (state, action) => {
        state.actingId = null;
        replace(state, action.payload);
      })
      .addCase(setUserActive.rejected, (state) => {
        state.actingId = null;
      })

      .addCase(resetUserPassword.pending, (state, action) => {
        state.actingId = action.meta.arg.id;
      })
      .addCase(resetUserPassword.fulfilled, (state, action) => {
        state.actingId = null;
        replace(state, splitEmailResult(action.payload).user);
      })
      .addCase(resetUserPassword.rejected, (state) => {
        state.actingId = null;
      });
  },
});

export const { clearCurrentUser } = userSlice.actions;
export default userSlice.reducer;
