import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import TextField from '../../components/inputs/TextField';
import Button from '../../components/buttons/Button';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import { forgotPasswordSchema, EMPTY_FORGOT_PASSWORD } from '../../validation/authSchema';
import { ROUTES } from '../../constants/routes';

const ForgotPassword = () => {
  usePageTitle('Forgot password');

  const { requestOtp, passwordReset } = useAuth();
  const { loading } = passwordReset;

  const { control, handleSubmit } = useForm({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: EMPTY_FORGOT_PASSWORD,
  });

  const onSubmit = handleSubmit((values) => requestOtp(values));

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your account email. If it exists, we'll send a 6-digit reset code."
      footer={
        <>
          Remembered it?{' '}
          <Link to={ROUTES.LOGIN} className="font-medium text-blue hover:text-blue-dk">
            Back to sign in
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

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="w-full"
          id="forgot-password-submit"
        >
          Send reset code
        </Button>

      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
