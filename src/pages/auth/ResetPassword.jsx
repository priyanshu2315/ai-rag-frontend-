import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/layout/AuthLayout';
import TextField from '../../components/inputs/TextField';
import PasswordField from '../../components/inputs/PasswordField';
import Button from '../../components/buttons/Button';
import useAuth from '../../hooks/useAuth';
import usePageTitle from '../../hooks/usePageTitle';
import { resetPasswordSchema, EMPTY_RESET_PASSWORD } from '../../validation/authSchema';
import { ROUTES } from '../../constants/routes';

const ResetPassword = () => {
  usePageTitle('Reset password');

  const navigate = useNavigate();
  const location = useLocation();

  // Email is passed via location state from ForgotPassword.
  // If the user lands here directly (no state), send them back to step 1.
  const email = location.state?.email ?? '';
  useEffect(() => {
    if (!email) navigate(ROUTES.FORGOT_PASSWORD, { replace: true });
  }, [email, navigate]);

  const { doResetPassword, passwordReset } = useAuth();
  const { loading } = passwordReset;

  const { control, handleSubmit } = useForm({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: EMPTY_RESET_PASSWORD,
  });

  const onSubmit = handleSubmit(({ otp, newPassword }) =>
    doResetPassword({ email, otp, newPassword })
  );

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={`Enter the 6-digit code sent to ${email || 'your email'}`}
      footer={
        <>
          Didn&apos;t get a code?{' '}
          <Link to={ROUTES.FORGOT_PASSWORD} className="font-medium text-blue hover:text-blue-dk">
            Resend
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Controller
          name="otp"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              label="One-time code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          name="newPassword"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="New password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              error={fieldState.error?.message}
            />
          )}
        />

        <Controller
          name="confirmNewPassword"
          control={control}
          render={({ field, fieldState }) => (
            <PasswordField
              {...field}
              label="Confirm new password"
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              error={fieldState.error?.message}
            />
          )}
        />

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="w-full"
          id="reset-password-submit"
        >
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
};

export default ResetPassword;
