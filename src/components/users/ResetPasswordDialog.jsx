import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import Modal from '../modals/Modal';
import Button from '../buttons/Button';
import TemporaryPasswordField from './TemporaryPasswordField';
import PasswordHandoff from './PasswordHandoff';
import { resetPasswordSchema } from '../../validation/userSchema';
import { generateTemporaryPassword } from '../../utils/password';
import notify from '../../utils/notify';

/**
 * Admin reset for a user who forgot their password: set a new temporary
 * password. The backend emails it; only if that email fails is it shown here
 * once for the admin to pass on.
 */
const ResetPasswordDialog = ({ user, saving, onReset, onClose }) => {
  const [handedOff, setHandedOff] = useState(null);
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(resetPasswordSchema),
    defaultValues: { temporaryPassword: generateTemporaryPassword() },
  });

  const onSubmit = handleSubmit(async ({ temporaryPassword }) => {
    const result = await onReset(user, temporaryPassword);
    if (!result) return;
    if (result.emailSent === true) {
      notify.success(`Login details were emailed to ${user.email}`);
      onClose();
    } else {
      setHandedOff(temporaryPassword);
    }
  });

  if (handedOff) {
    return <PasswordHandoff title="Password reset" user={user} password={handedOff} onDone={onClose} />;
  }

  return (
    <Modal title="Reset password" description={user.email} onClose={onClose} closeDisabled={saving}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <p className="text-[13px] text-ink-2">
          We'll email this temporary password to {user.email}. They must choose a new one the next time they sign in.
        </p>
        <Controller
          name="temporaryPassword"
          control={control}
          render={({ field, fieldState }) => (
            <TemporaryPasswordField {...field} label="New temporary password" error={fieldState.error?.message} />
          )}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" loading={saving}>Reset password</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ResetPasswordDialog;
