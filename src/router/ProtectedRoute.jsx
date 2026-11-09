import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ROUTES } from '../constants/routes';

/**
 * Signed-in only. Remembers where the user was headed so login can return them.
 *
 * While the account still has a temporary password, the set-password screen
 * is the only place it may be — the backend refuses everything else with
 * PASSWORD_CHANGE_REQUIRED anyway, and that response flips the same flag.
 */
const ProtectedRoute = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const mustChangePassword = useSelector((state) => Boolean(state.auth.user?.mustChangePassword));
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (mustChangePassword && location.pathname !== ROUTES.SET_PASSWORD) {
    return <Navigate to={ROUTES.SET_PASSWORD} replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
