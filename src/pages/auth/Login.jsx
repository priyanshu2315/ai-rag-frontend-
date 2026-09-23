import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import TextField from '../../components/inputs/TextField';
import PasswordField from '../../components/inputs/PasswordField';
import Button from '../../components/buttons/Button';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import { loginSchema, EMPTY_LOGIN } from '../../validation/authSchema';
import { ROUTES } from '../../constants/routes';

const Login = () => {
  usePageTitle('Sign in');

  const { signIn, loading } = useAuth();
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(loginSchema),
    defaultValues: EMPTY_LOGIN,
  });

  // No try/catch: the axios layer toasts the failure, `signIn` just reports
  // whether it worked (§15.11).
  const onSubmit = handleSubmit((values) => signIn(values));

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to chat with your documents"
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to={ROUTES.REGISTER} className="font-medium text-blue hover:text-blue-dk">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
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

        <div className="text-right -mt-2">
          <Link
            to={ROUTES.FORGOT_PASSWORD}
            className="text-sm font-medium text-blue hover:text-blue-dk"
          >
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
