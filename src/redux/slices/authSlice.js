import { createSlice } from '@reduxjs/toolkit';
import { login, changePassword, forgotPassword, resetPassword } from '../actions/authActions';
import { isCanceled } from '../createAppThunk';
import { USER_TYPE } from '../../constants/permissions';

/**
 * The only persisted slice (§7.1). Token storage is redux-persist's job —
 * reducers never touch localStorage themselves.
 *
 * `user` is `{ userId, email, name, type, mustChangePassword }`. `type` gates
 * the admin modules; `mustChangePassword` keeps the user on the set-password
 * screen until it is cleared.
 */
const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  /** Last sign-in failure, shown on the form: `{ status, message }`. */
  error: null,
  passwordChange: {
    loading: false,
    error: null,
  },
  passwordReset: {
    loading: false,
    error: null,
    /** Email carried from step 1 → step 2, kept here so components stay thin. */
    email: null,
  },
};

/** A failed request as the form shows it, or null for a cancellation. */
const failureOf = (action) =>
  isCanceled(action) ? null : { status: action.payload?.status ?? null, message: action.payload?.message ?? null };

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout: () => initialState,
    clearError: (state) => {
      state.error = null;
    },
    clearPasswordChange: (state) => {
      state.passwordChange = initialState.passwordChange;
    },
    clearPasswordReset: (state) => {
      state.passwordReset = initialState.passwordReset;
    },
    /** The backend answered PASSWORD_CHANGE_REQUIRED; the route guard takes it from here. */
    passwordChangeRequired: (state) => {
      if (state.user) state.user.mustChangePassword = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        const { token, userId, email, name, type, mustChangePassword } = action.payload || {};
        state.loading = false;
        state.token = token ?? null;
        state.user = token
          ? {
              userId,
              email,
              name: name ?? null,
              type: type ?? USER_TYPE.USER,
              mustChangePassword: Boolean(mustChangePassword),
            }
          : null;
        state.isAuthenticated = Boolean(token);
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false;
        state.error = failureOf(action);
      })

      // ── Change password (forced screen + user menu) ──────────────────────
      .addCase(changePassword.pending, (state) => {
        state.passwordChange.loading = true;
        state.passwordChange.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.passwordChange = initialState.passwordChange;
        // Same token stays valid; only the flag changes.
        if (state.user) state.user.mustChangePassword = false;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.passwordChange.loading = false;
        state.passwordChange.error = failureOf(action);
      })

      // ── Forgot password (step 1) ─────────────────────────────────────────
      .addCase(forgotPassword.pending, (state) => {
        state.passwordReset.loading = true;
        state.passwordReset.error = null;
      })
      // The response may still carry a development `otp` field. It is never
      // stored or shown: the code arrives by email.
      .addCase(forgotPassword.fulfilled, (state, action) => {
        state.passwordReset.loading = false;
        state.passwordReset.email = action.meta?.arg?.email ?? null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.passwordReset.loading = false;
        if (isCanceled(action)) return;
        // A 500 is the backend's unknown-email leftover; it reads as success.
        if (action.payload?.status === 500) {
          state.passwordReset.email = action.meta?.arg?.email ?? null;
          return;
        }
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

export const { logout, clearError, clearPasswordChange, clearPasswordReset, passwordChangeRequired } =
  authSlice.actions;
export default authSlice.reducer;
