import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Trash2, User } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import TextField from '../../components/inputs/TextField';
import TextareaField from '../../components/inputs/TextareaField';
import MultiSelectField from '../../components/inputs/MultiSelectField';
import Button from '../../components/buttons/Button';
import { DocumentStatusBadge } from '../../components/badges/StatusBadge';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import ErrorState from '../../components/feedback/ErrorState';
import { FormSkeleton, TextSkeleton } from '../../components/feedback/Skeletons';
import { useRoleEditor } from '../../hooks/useRoles';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, rolePath, userPath } from '../../constants/routes';
import { roleDeleteMessage } from '../../utils/roles';
import { formatDate } from '../../utils/format';
import { roleSchema, EMPTY_ROLE } from '../../validation/roleSchema';

const Section = ({ title, children, aside }) => (
  <section className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
    <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
      <h2 className="flex-1 text-[13.5px] font-semibold">{title}</h2>
      {aside}
    </div>
    <div className="space-y-4 p-4">{children}</div>
  </section>
);

const valuesOf = (role) => (role
  ? { name: role.name ?? '', description: role.description ?? '', documentIds: (role.documents ?? []).map((doc) => doc.id) }
  : EMPTY_ROLE);

/**
 * The form itself. Mounted with a key per role (`new` or the id), so going
 * from editing one role to creating another always starts empty (§7.3).
 */
const RoleForm = ({ role, library, libraryLoading, libraryError, saving, onSave, onCancel }) => {
  const { control, handleSubmit } = useForm({
    resolver: yupResolver(roleSchema),
    defaultValues: valuesOf(role),
  });

  // The role's own documents stay listed even if the library has not loaded
  // (or no longer has them), so a selection is never silently dropped.
  const options = useMemo(() => {
    const byId = new Map(library.map((doc) => [doc.id, doc]));
    (role?.documents ?? []).forEach((doc) => { if (!byId.has(doc.id)) byId.set(doc.id, doc); });
    return [...byId.values()]
      .sort((a, b) => a.filename.localeCompare(b.filename))
      .map((doc) => ({ value: doc.id, label: doc.filename, meta: <DocumentStatusBadge status={doc.status} /> }));
  }, [library, role]);

  return (
    <form onSubmit={handleSubmit(onSave)} className="space-y-4" noValidate>
      <Section title="Details">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <TextField {...field} label="Role name" required maxLength={100} placeholder="e.g. Finance" error={fieldState.error?.message} />
          )}
        />
        <Controller
          name="description"
          control={control}
          render={({ field, fieldState }) => (
            <TextareaField {...field} label="Description" rows={2} placeholder="Who this role is for (optional)" error={fieldState.error?.message} />
          )}
        />
      </Section>

      <Section title="Documents">
        <Controller
          name="documentIds"
          control={control}
          render={({ field, fieldState }) => (
            <MultiSelectField
              {...field}
              label="Documents in this role"
              hint={libraryError
                ? `Couldn't load the library: ${libraryError}`
                : 'Users with this role can see and search exactly these documents.'}
              options={options}
              loading={libraryLoading}
              searchPlaceholder="Filter documents…"
              emptyText="The library is empty — upload a document first."
              error={fieldState.error?.message}
            />
          )}
        />
      </Section>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{role ? 'Save changes' : 'Create role'}</Button>
      </div>
    </form>
  );
};

/** Admin module page: create a role (`/roles/new`) or edit one (`/roles/:roleId`). */
const RoleEditor = () => {
  const { roleId } = useParams();
  const navigate = useNavigate();
  const editor = useRoleEditor(roleId);
  const { role } = editor;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  usePageTitle(roleId ? role?.name ?? 'Role' : 'New role');

  const onSave = async (values) => {
    if (await editor.save(values)) navigate(ROUTES.ROLES);
  };

  const onDelete = async () => {
    if (await editor.remove()) navigate(ROUTES.ROLES, { replace: true });
  };

  return (
    <>
      <PageHead
        crumbs={roleId
          ? [{ label: 'Roles', to: ROUTES.ROLES }, { label: role?.name ?? 'Role', to: rolePath(roleId) }]
          : [{ label: 'Roles', to: ROUTES.ROLES }]}
        title={roleId ? role?.name ?? <TextSkeleton className="h-4 w-36" /> : 'New role'}
        subtitle={roleId ? 'Change what this role can see' : 'Name it, then choose its documents'}
        actions={role && (
          <Button variant="ghost" size="sm" className="h-9 hover:bg-red-bg hover:text-red" onClick={() => setConfirmingDelete(true)}>
            <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete role</span>
          </Button>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
          {editor.error ? (
            <ErrorState message={editor.error} onRetry={editor.reload} />
          ) : editor.loading ? (
            <FormSkeleton sections={[2, 'list']} />
          ) : (
            <>
              <RoleForm
                key={roleId ?? 'new'}
                role={role}
                library={editor.library}
                libraryLoading={editor.libraryLoading}
                libraryError={editor.libraryError}
                saving={editor.saving}
                onSave={onSave}
                onCancel={() => navigate(ROUTES.ROLES)}
              />

              {role && (
                <Section
                  title="Users with this role"
                  aside={<span className="mono text-[11px] text-muted">{role.users?.length ?? 0}</span>}
                >
                  {role.users?.length ? (
                    <ul className="-my-2 divide-y divide-border">
                      {role.users.map((user) => (
                        <li key={user.id} className="flex items-center gap-2.5 py-2 text-[13px]">
                          <User className="h-4 w-4 shrink-0 text-muted" />
                          <Link to={userPath(user.id)} className="min-w-0 flex-1 truncate hover:text-blue">
                            <span className="font-medium text-ink">{user.name || user.email}</span>
                            {user.name && <span className="text-muted"> · {user.email}</span>}
                          </Link>
                          <span className="mono shrink-0 text-[11px] text-muted">since {formatDate(user.assignedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-muted">
                      Nobody has this role yet. Give it to someone from the <Link to={ROUTES.USERS} className="font-medium text-blue hover:underline">Users</Link> module.
                    </p>
                  )}
                </Section>
              )}
            </>
          )}
        </div>
      </div>

      {confirmingDelete && role && (
        <ConfirmDialog
          title={`Delete “${role.name}”?`}
          message={roleDeleteMessage(role)}
          confirmLabel="Delete role"
          loading={editor.deleting}
          onConfirm={onDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
};

export default RoleEditor;
