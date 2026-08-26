import { createSlice } from '@reduxjs/toolkit';
import { login, register } from '../actions/authActions';
import { isCanceled } from '../createAppThunk';

/**
 * The only persisted slice (§7.1). Token storage is redux-persist's job —
 * reducers never touch localStorage themselves.
 */
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: () => initialState,
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        const { token, userId, email } = action.payload || {};
        state.loading = false;
        state.token = token ?? null;
        state.user = token ? { userId, email } : null;
        state.isAuthenticated = Boolean(token);
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        if (isCanceled(action)) return;
        state.error = action.payload?.message ?? null;
      })

      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        if (isCanceled(action)) return;
        state.error = action.payload?.message ?? null;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
