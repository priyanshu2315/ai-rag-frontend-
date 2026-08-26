import { Navigate, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { ROUTES } from '../constants/routes';

/** Keeps a signed-in user out of /login and /register. */
const GuestRoute = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  return isAuthenticated ? <Navigate to={ROUTES.CHAT} replace /> : <Outlet />;
};

export default GuestRoute;
