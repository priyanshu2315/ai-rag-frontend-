import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import PasswordField from '../inputs/PasswordField';
import Button from '../buttons/Button';
import Alert from '../feedback/Alert';
import useAuth from '../../hooks/useAuth';
import { changePasswordSchema, EMPTY_CHANGE_PASSWORD } from '../../validation/authSchema';

/**
 * Current + new + confirm, for both the forced first-login screen and
 * "Change password" in the user menu.
 *
 * Errors stay on the form: a 401 here means "Current password is incorrect"
 * (shown under that field), never an ended session; a 400 is one of the rules
 * already checked client-side, so it shows as a form-level message.
 */
const ChangePasswordForm = ({ submitLabel = 'Change password', onDone, onCancel }) => {
  const { updatePassword, passwordChange, resetPasswordChange } = useAuth();
  const { loading, error } = passwordChange;

  const { control, handleSubmit, setError } = useForm({
    resolver: yupResolver(changePasswordSchema),
    defaultValues: EMPTY_CHANGE_PASSWORD,
  });

  // A failure from an earlier visit must not greet the next one.
  useEffect(() => {
    resetPasswordChange();
    return resetPasswordChange;
  }, [resetPasswordChange]);

  useEffect(() => {
    if (error?.status === 401) {
      setError('currentPassword', { message: error.message || 'Current password is incorrect' });
    }
  }, [error, setError]);

  const onSubmit = handleSubmit(async (values) => {
    if (await updatePassword(values)) onDone?.();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {/* 5xx and network failures were already toasted by the axios layer. */}
      {error?.status === 400 && error.message && <Alert>{error.message}</Alert>}

      <Controller
        name="currentPassword"
        control={control}
        render={({ field, fieldState }) => (
          <PasswordField
            {...field}
            label="Current password"
            autoComplete="current-password"
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
            hint="At least 8 characters, different from the current one."
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
            error={fieldState.error?.message}
          />
        )}
      />

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading} className={onCancel ? undefined : 'w-full'}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};

export default ChangePasswordForm;
