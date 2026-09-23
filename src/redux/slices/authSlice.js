import { createSlice } from '@reduxjs/toolkit';
import { login, register, forgotPassword, resetPassword } from '../actions/authActions';
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
  passwordReset: {
    loading: false,
    error: null,
    /** OTP returned by /forgot-password (dev/demo mode only). */
    otp: null,
    /** Email carried from step 1 → step 2, kept here so components stay thin. */
    email: null,
  },
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: () => initialState,
    clearError: (state) => {
      state.error = null;
    },
    clearPasswordReset: (state) => {
      state.passwordReset = initialState.passwordReset;
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
      })

      // ── Forgot password (step 1) ─────────────────────────────────────────
      .addCase(forgotPassword.pending, (state) => {
        state.passwordReset.loading = true;
        state.passwordReset.error = null;
        state.passwordReset.otp = null;
      })
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.passwordReset.loading = false;
        // Dev/demo mode: OTP is returned directly in the response.
        state.passwordReset.otp = action.payload?.otp ?? null;
        state.passwordReset.email = action.meta?.arg?.email ?? null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.passwordReset.loading = false;
        if (isCanceled(action)) return;
        state.passwordReset.error = action.payload?.message ?? null;
      })

      // ── Reset password (step 2) ──────────────────────────────────────────
      .addCase(resetPassword.pending, (state) => {
        state.passwordReset.loading = true;
        state.passwordReset.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.passwordReset = initialState.passwordReset;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.passwordReset.loading = false;
        if (isCanceled(action)) return;
        state.passwordReset.error = action.payload?.message ?? null;
      });
  },
});

export const { logout, clearError, clearPasswordReset } = authSlice.actions;
export default authSlice.reducer;
