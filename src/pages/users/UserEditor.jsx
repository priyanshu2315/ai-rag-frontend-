import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { KeyRound, Power } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import TextField from '../../components/inputs/TextField';
import SelectField from '../../components/inputs/SelectField';
import MultiSelectField from '../../components/inputs/MultiSelectField';
import Button from '../../components/buttons/Button';
import { Badge } from '../../components/badges/StatusBadge';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import ErrorState from '../../components/feedback/ErrorState';
import { FormSkeleton, TextSkeleton } from '../../components/feedback/Skeletons';
import TemporaryPasswordField from '../../components/users/TemporaryPasswordField';
import PasswordHandoff from '../../components/users/PasswordHandoff';
import ResetPasswordDialog from '../../components/users/ResetPasswordDialog';
import { useUserEditor } from '../../hooks/useUsers';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, userPath } from '../../constants/routes';
import { USER_TYPE } from '../../constants/permissions';
import { userSchema, EMPTY_USER } from '../../validation/userSchema';
import { generateTemporaryPassword } from '../../utils/password';
import notify from '../../utils/notify';

const TYPE_OPTIONS = [
  { value: USER_TYPE.USER, label: 'User — sees the documents in their roles' },
  { value: USER_TYPE.ADMIN, label: 'Admin — sees every document and manages the app' },
];

const Section = ({ title, children }) => (
  <section className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
    <h2 className="border-b border-border bg-surface-2 px-4 py-2.5 text-[13.5px] font-semibold">{title}</h2>
    <div className="space-y-4 p-4">{children}</div>
  </section>
);

const valuesOf = (user) => (user
  ? { ...EMPTY_USER, name: user.name ?? '', email: user.email, type: user.type, roleIds: (user.roles ?? []).map((role) => role.id) }
  : { ...EMPTY_USER, temporaryPassword: generateTemporaryPassword() });

/** Mounted with a key per user (`new` or the id), so create always starts empty (§7.3). */
const UserForm = ({ user, isMe, roles, rolesLoading, saving, onSave, onCancel }) => {
  const mode = user ? 'edit' : 'create';
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(userSchema(mode)),
    defaultValues: valuesOf(user),
  });

  const roleOptions = useMemo(() => roles
    .map((role) => ({
      value: role.id,
      label: role.name,
      meta: <span className="mono text-[11px] text-muted">{role.documentCount ?? 0} docs</span>,
    }))
    .sort((a, b) => a.label.localeCompare(b.label)), [roles]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4" noValidate>
      <Section title="Account">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Name" required autoComplete="off" error={fieldState.error?.message} />
          )}
        />

        {mode === 'create' ? (
          <>
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <TextField {...field} label="Email" type="email" required autoComplete="off" hint="Saved in lowercase. Used to sign in." error={fieldState.error?.message} />
              )}
            />
            <Controller
              name="temporaryPassword"
              control={control}
              render={({ field, fieldState }) => <TemporaryPasswordField {...field} error={fieldState.error?.message} />}
            />
          </>
        ) : (
          <TextField label="Email" value={user.email} readOnly disabled hint="An email can't be changed." />
        )}

        <Controller
          name="type"
          control={control}
          render={({ field, fieldState }) => (
            <SelectField
              {...field}
              label="Type"
              options={TYPE_OPTIONS}
              // The backend refuses to demote your own account.
              disabled={isMe}
              hint={isMe ? "You can't change your own account type." : undefined}
              error={fieldState.error?.message}
            />
          )}
        />
      </Section>

      <Section title="Roles">
        <Controller
          name="roleIds"
          control={control}
          render={({ field, fieldState }) => (
            <MultiSelectField
              {...field}
              label="Roles"
              hint="The user sees every document in any of these roles. No roles means no documents (admins see everything regardless)."
              options={roleOptions}
              loading={rolesLoading}
              searchPlaceholder="Filter roles…"
              emptyText="No roles exist yet — create one in the Roles module."
              error={fieldState.error?.message}
            />
          )}
        />
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{user ? 'Save changes' : 'Create user'}</Button>
      </div>
    </form>
  );
};

/** Admin module page: create a user (`/users/new`) or edit one (`/users/:userId`). */
const UserEditor = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const editor = useUserEditor(userId);
  const { user } = editor;
  const myId = useSelector((state) => state.auth.user?.userId);
  const isMe = Boolean(user) && user.id === myId;
  const [created, setCreated] = useState(null); // { user, password } — only when the email failed
  const [dialog, setDialog] = useState(null); // 'disable' | 'reset' | null
  usePageTitle(userId ? user?.name || user?.email || 'User' : 'New user');

  const onSave = async (values) => {
    const result = await editor.save(values);
    if (!result) return;
    if (userId) {
      navigate(ROUTES.USERS);
    } else if (result.emailSent === true) {
      // The backend emailed the sign-in link, email and temporary password.
      notify.success(`Login details were emailed to ${result.user.email}`);
      navigate(ROUTES.USERS);
    } else {
      // Mail failed (or wasn't reported): the admin passes the details on.
      setCreated({ user: result.user, password: values.temporaryPassword });
    }
  };

  const confirmDisable = async () => {
    if (await editor.setActive(user, false)) setDialog(null);
  };

  const busy = editor.actingId === user?.id;

  return (
    <>
      <PageHead
        crumbs={userId
          ? [{ label: 'Users', to: ROUTES.USERS }, { label: user?.name || user?.email || 'User', to: userPath(userId) }]
          : [{ label: 'Users', to: ROUTES.USERS }]}
        title={userId ? user?.name || user?.email || <TextSkeleton className="h-4 w-36" /> : 'New user'}
        subtitle={userId && !user ? <TextSkeleton className="h-3 w-48" /> : user ? (
          <span className="inline-flex items-center gap-2">
            <Badge tone={user.isActive ? 'ready' : 'failed'}>{user.isActive ? 'Active' : 'Disabled'}</Badge>
            {user.mustChangePassword && 'Has a temporary password'}
          </span>
        ) : "We'll email their login details; they set their own password at first sign-in"}
        actions={user && (
          <>
            <Button variant="ghost" size="sm" className="h-9" onClick={() => setDialog('reset')} disabled={busy}>
              <KeyRound className="h-4 w-4" /> <span className="hidden sm:inline">Reset password</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={user.isActive ? 'h-9 hover:bg-red-bg hover:text-red' : 'h-9 hover:bg-green-bg hover:text-green'}
              onClick={() => (user.isActive ? setDialog('disable') : editor.setActive(user, true))}
              disabled={busy || isMe}
              title={isMe ? "You can't disable your own account" : undefined}
            >
              <Power className="h-4 w-4" /> <span className="hidden sm:inline">{user.isActive ? 'Disable' : 'Enable'}</span>
            </Button>
          </>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          {editor.error ? (
            <ErrorState message={editor.error} onRetry={editor.reload} />
          ) : editor.loading ? (
            <FormSkeleton sections={[3, 'list']} />
          ) : (
            <UserForm
              key={userId ?? 'new'}
              user={user}
              isMe={isMe}
              roles={editor.roles}
              rolesLoading={editor.rolesLoading}
              saving={editor.saving}
              onSave={onSave}
              onCancel={() => navigate(ROUTES.USERS)}
            />
          )}
        </div>
      </div>

      {created && (
        <PasswordHandoff
          title="User created"
          user={created.user}
          password={created.password}
          onDone={() => navigate(ROUTES.USERS)}
        />
      )}

      {dialog === 'disable' && user && (
        <ConfirmDialog
          title={`Disable ${user.name || user.email}?`}
          message="They are signed out on their next request and can't sign in until you enable the account again. Their roles are kept."
          confirmLabel="Disable account"
          loading={busy}
          onConfirm={confirmDisable}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'reset' && user && (
        <ResetPasswordDialog user={user} saving={busy} onReset={editor.resetPassword} onClose={() => setDialog(null)} />
      )}
    </>
  );
};

export default UserEditor;
