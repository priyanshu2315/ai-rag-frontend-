import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { login, changePassword, forgotPassword, resetPassword } from '../redux/actions/authActions';
import { logout, clearError, clearPasswordChange, clearPasswordReset } from '../redux/slices/authSlice';
import { persistor } from '../redux/store';
import { ROUTES } from '../constants/routes';
import { MESSAGES } from '../constants/messages';
import notify from '../utils/notify';

/**
 * Everything auth a page needs, so pages stay thin (§2).
 *
 * Actions resolve to a boolean instead of throwing — errors are already
 * handled by the axios layer or kept in the slice for the form to show, so
 * there is nothing to catch (§15.11).
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading, error, passwordChange, passwordReset } = useSelector(
    (state) => state.auth
  );

  // Where the user was headed before ProtectedRoute bounced them here, so an
  // expired session on a document URL returns to that document, not to root.
  const from = location.state?.from?.pathname ?? ROUTES.CHAT;

  const signIn = useCallback(
    async (credentials) => {
      const result = await dispatch(login(credentials));
      const ok = login.fulfilled.match(result) && Boolean(result.payload?.token);
      if (!ok) return false;

      // A temporary password is changed before anything else — keeping `from`
      // so the user still lands where they were going once it is done.
      if (result.payload.mustChangePassword) {
        navigate(ROUTES.SET_PASSWORD, { replace: true, state: { from: { pathname: from } } });
      } else {
        navigate(from, { replace: true });
      }
      return true;
    },
    [dispatch, navigate, from]
  );

  const resetSignInError = useCallback(() => dispatch(clearError()), [dispatch]);

  const signOut = useCallback(() => {
    dispatch(logout());
    persistor.purge();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [dispatch, navigate]);

  /** Change password while signed in. The token stays valid; the flag clears. */
  const updatePassword = useCallback(
    async ({ currentPassword, newPassword }) => {
      const result = await dispatch(changePassword({ currentPassword, newPassword }));
      const ok = changePassword.fulfilled.match(result);
      if (ok) notify.success('Password changed');
      return ok;
    },
    [dispatch]
  );

  const resetPasswordChange = useCallback(() => dispatch(clearPasswordChange()), [dispatch]);

  /**
   * Step 1: request a reset code (it is emailed). The same neutral message
   * shows whether or not the account exists — including on the backend's
   * unknown-email 500 — so the screen never reveals which emails are real.
   */
  const requestOtp = useCallback(
    async ({ email }) => {
      const result = await dispatch(forgotPassword({ email }));
      const ok = forgotPassword.fulfilled.match(result) || result.payload?.status === 500;
      if (ok) {
        notify.info(MESSAGES.RESET_CODE_SENT);
        navigate(ROUTES.RESET_PASSWORD, { state: { email }, replace: false });
      }
      return ok;
    },
    [dispatch, navigate]
  );

  /** Step 2: submits email + otp + newPassword, navigates to login on success. */
  const doResetPassword = useCallback(
    async (payload) => {
      const result = await dispatch(resetPassword(payload));
      const ok = resetPassword.fulfilled.match(result);
      if (ok) {
        dispatch(clearPasswordReset());
        notify.success('Password reset — sign in with your new password');
        navigate(ROUTES.LOGIN, { replace: true });
      }
      return ok;
    },
    [dispatch, navigate]
  );

  return {
    user,
    isAuthenticated,
    loading,
    error,
    passwordChange,
    passwordReset,
    signIn,
    resetSignInError,
    signOut,
    updatePassword,
    resetPasswordChange,
    requestOtp,
    doResetPassword,
  };
};

export default useAuth;
