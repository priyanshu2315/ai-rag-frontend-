import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import TextField from '../../components/inputs/TextField';
import PasswordField from '../../components/inputs/PasswordField';
import Button from '../../components/buttons/Button';
import Alert from '../../components/feedback/Alert';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import { loginSchema, EMPTY_LOGIN } from '../../validation/authSchema';
import { ROUTES } from '../../constants/routes';

/** The form-level message for a failed sign-in, or null. */
const SignInError = ({ error }) => {
  if (!error) return null;

  // A disabled account is final — say so plainly and point at the person who
  // can change it, rather than inviting another attempt.
  if (error.status === 403) {
    return (
      <Alert title="Account is disabled">
        An administrator has turned this account off. Contact them to have it re-enabled.
      </Alert>
    );
  }

  if (error.status === 401) return <Alert>Incorrect email or password.</Alert>;

  // Anything else (5xx, network) was already toasted by the axios layer.
  return error.status === 400 && error.message ? <Alert>{error.message}</Alert> : null;
};

/**
 * Sign-in only. Accounts are created by an admin, so there is no sign-up link.
 */
const Login = () => {
  usePageTitle('Sign in');

  const { signIn, loading, error, resetSignInError } = useAuth();
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: EMPTY_LOGIN,
  });

  // An expired-session redirect or an earlier visit must not leave a stale error.
  useEffect(() => {
    resetSignInError();
  }, [resetSignInError]);

  // No try/catch: `signIn` reports whether it worked and the slice keeps the
  // failure for the form (§15.11).
  const onSubmit = handleSubmit((values) => signIn(values));

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to chat with your documents"
      footer="Need an account? Ask your administrator."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <SignInError error={error} />

        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="Password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={fieldState.error?.message}
            />
          )}
        />

        <div className="-mt-2 text-right">
          <Link to={ROUTES.FORGOT_PASSWORD} className="text-sm font-medium text-blue hover:text-blue-dk">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Login;
