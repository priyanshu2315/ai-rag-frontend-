import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { login, register, forgotPassword, resetPassword } from '../redux/actions/authActions';
import { logout, clearPasswordReset } from '../redux/slices/authSlice';
import { persistor } from '../redux/store';
import { ROUTES } from '../constants/routes';
import notify from '../utils/notify';

/**
 * Everything auth a page needs, so pages stay thin (§2).
 *
 * `signIn`/`signUp` resolve to a boolean instead of throwing — errors are
 * already toasted by the axios layer, so there is nothing to catch (§15.11).
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, loading, error, passwordReset } = useSelector(
    (state) => state.auth
  );

  // Where the user was headed before ProtectedRoute bounced them here, so an
  // expired session on a document URL returns to that document, not to root.
  const from = location.state?.from?.pathname ?? ROUTES.CHAT;

  const signIn = useCallback(
    async (credentials) => {
      const result = await dispatch(login(credentials));
      const ok = login.fulfilled.match(result) && Boolean(result.payload?.token);
      if (ok) navigate(from, { replace: true });
      return ok;
    },
    [dispatch, navigate, from]
  );

  const signUp = useCallback(
    async (payload) => {
      const result = await dispatch(register(payload));
      const ok = register.fulfilled.match(result);
      if (ok) {
        notify.success('Account created — sign in to continue');
        navigate(ROUTES.LOGIN, { replace: true });
      }
      return ok;
    },
    [dispatch, navigate]
  );

  const signOut = useCallback(() => {
    dispatch(logout());
    persistor.purge();
    navigate(ROUTES.LOGIN, { replace: true });
  }, [dispatch, navigate]);

  /**
   * Step 1: sends the forgot-password request and navigates to the reset screen
   * on success, carrying the email in location state.
   */
  const requestOtp = useCallback(
    async ({ email }) => {
      const result = await dispatch(forgotPassword({ email }));
      const ok = forgotPassword.fulfilled.match(result);
      if (ok) {
        navigate(ROUTES.RESET_PASSWORD, { state: { email }, replace: false });
      }
      return ok;
    },
    [dispatch, navigate]
  );

  /**
   * Step 2: submits email + otp + newPassword, navigates to login on success.
   */
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
    passwordReset,
    signIn,
    signUp,
    signOut,
    requestOtp,
    doResetPassword,
  };
};

export default useAuth;
