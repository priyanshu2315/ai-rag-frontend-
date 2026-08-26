import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import TextField from '../../components/inputs/TextField';
import PasswordField from '../../components/inputs/PasswordField';
import Button from '../../components/buttons/Button';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import { registerSchema, EMPTY_REGISTER } from '../../validation/authSchema';
import { ROUTES } from '../../constants/routes';

const Register = () => {
  usePageTitle('Create account');

  const { signUp, loading } = useAuth();
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(registerSchema),
    defaultValues: EMPTY_REGISTER,
  });

  const onSubmit = handleSubmit(({ email, password }) => signUp({ email, password }));

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Upload documents and ask them questions"
      footer={
        <>
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} className="font-medium text-blue hover:text-blue-dk">
            Sign in
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
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="Confirm password"
              autoComplete="new-password"
              placeholder="Re-enter your password"
              error={fieldState.error?.message}
            />
          )}
        />

        <Button type="submit" size="lg" loading={loading} className="w-full">
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
};

export default Register;
