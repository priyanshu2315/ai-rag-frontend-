import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import AuthLayout from '../../components/layout/AuthLayout';
import ChangePasswordForm from '../../components/forms/ChangePasswordForm';
import Button from '../../components/buttons/Button';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES } from '../../constants/routes';

/**
 * The forced first-login screen for accounts an admin created with a
 * temporary password. Nothing else is reachable until it succeeds; once the
 * flag clears, the user continues to wherever they were headed.
 */
const SetPassword = () => {
  usePageTitle('Set a new password');

  const mustChangePassword = useSelector((state) => Boolean(state.auth.user?.mustChangePassword));
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? ROUTES.CHAT;

  // Reached by hand without the flag — there is nothing to do here.
  if (!mustChangePassword) return <Navigate to={from} replace />;

  return (
    <AuthLayout
      title="Set a new password"
      subtitle={`${user?.email ?? 'Your account'} was created with a temporary password. Choose your own to continue.`}
      footer={
        <Button variant="ghost" size="sm" onClick={signOut}>
          Sign out instead
        </Button>
      }
    >
      <ChangePasswordForm
        submitLabel="Set password and continue"
        onDone={() => navigate(from, { replace: true })}
      />
    </AuthLayout>
  );
};

export default SetPassword;
