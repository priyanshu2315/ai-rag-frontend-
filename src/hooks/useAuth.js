import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { login, register } from '../redux/actions/authActions';
import { logout } from '../redux/slices/authSlice';
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
  const { user, isAuthenticated, loading, error } = useSelector((state) => state.auth);

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

  return { user, isAuthenticated, loading, error, signIn, signUp, signOut };
};

export default useAuth;
