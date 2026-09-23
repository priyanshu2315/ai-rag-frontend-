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
  const { loading, otp } = passwordReset;

  const { control, handleSubmit } = useForm({
    resolver: yupResolver(forgotPasswordSchema),
    defaultValues: EMPTY_FORGOT_PASSWORD,
  });

  const onSubmit = handleSubmit((values) => requestOtp(values));

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a one-time code"
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

        {otp && (
          <div
            role="status"
            aria-live="polite"
            style={{
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.35)',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              lineHeight: '1.5',
            }}
          >
            <p style={{ fontWeight: 600, marginBottom: '0.25rem', color: 'rgb(59,130,246)' }}>
              🔐 Dev mode — your OTP
            </p>
            <p style={{ letterSpacing: '0.2em', fontSize: '1.25rem', fontWeight: 700 }}>{otp}</p>
            <p style={{ marginTop: '0.25rem', opacity: 0.7 }}>
              Copy this code and paste it on the next screen. It expires in 10 minutes.
            </p>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          loading={loading}
          className="w-full"
          id="forgot-password-submit"
        >
          {otp ? 'Resend code' : 'Send reset code'}
        </Button>

        {otp && (
          <div className="text-center">
            <Link
              to={ROUTES.RESET_PASSWORD}
              className="font-medium text-blue hover:text-blue-dk text-sm"
            >
              I already have a code →
            </Link>
          </div>
        )}
      </form>
    </AuthLayout>
  );
};

export default ForgotPassword;
