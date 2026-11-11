import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Pencil, Shield } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import { Badge } from '../../components/badges/StatusBadge';
import ErrorState from '../../components/feedback/ErrorState';
import { FormSkeleton, TextSkeleton } from '../../components/feedback/Skeletons';
import { useUserEditor } from '../../hooks/useUsers';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, rolePath, userEditPath } from '../../constants/routes';
import { USER_TYPE } from '../../constants/permissions';

const primaryLink = 'inline-flex h-9 items-center gap-2 rounded-(--radius-sm) bg-blue-solid px-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-solid-hover';

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:gap-4">
    <dt className="w-32 shrink-0 text-[12px] text-muted">{label}</dt>
    <dd className="min-w-0 flex-1 text-[13px] break-words text-ink">{children}</dd>
  </div>
);

const Section = ({ title, count, children }) => (
  <section className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
    <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
      <h2 className="flex-1 text-[13.5px] font-semibold">{title}</h2>
      {count != null && <span className="mono text-[11px] text-muted">{count}</span>}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

/** Admin module page: a user at a glance (`/users/:userId`). Editing is one click away. */
const UserDetail = () => {
  const { userId } = useParams();
  const { user, loading, error, reload } = useUserEditor(userId);
  const myId = useSelector((state) => state.auth.user?.userId);
  usePageTitle(user?.name || user?.email || 'User');
  const roles = user?.roles ?? [];

  return (
    <>
      <PageHead
        crumbs={[{ label: 'Users', to: ROUTES.USERS }]}
        title={user ? `${user.name || user.email}${user.id === myId ? ' (you)' : ''}` : <TextSkeleton className="h-4 w-36" />}
        subtitle={user?.name ? user.email : undefined}
        actions={user && (
          <Link to={userEditPath(userId)} className={primaryLink}>
            <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit user</span><span className="sm:hidden">Edit</span>
          </Link>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading ? (
            <FormSkeleton sections={[3, 'list']} />
          ) : (
            <>
              <Section title="Account">
                <dl className="-my-2 divide-y divide-border">
                  <Field label="Name">{user.name || '—'}</Field>
                  <Field label="Email">{user.email}</Field>
                  <Field label="Type">
                    <Badge tone={user.type === USER_TYPE.ADMIN ? 'working' : 'idle'}>{user.type === USER_TYPE.ADMIN ? 'Admin' : 'User'}</Badge>
                  </Field>
                  <Field label="Status">
                    <Badge tone={user.isActive ? 'ready' : 'failed'}>{user.isActive ? 'Active' : 'Disabled'}</Badge>
                    {user.mustChangePassword && <span className="ml-2 text-[12px] text-muted">Has a temporary password</span>}
                  </Field>
                </dl>
              </Section>

              <Section title="Roles" count={roles.length}>
                {roles.length ? (
                  <ul className="-my-2 divide-y divide-border">
                    {roles.map((role) => (
                      <li key={role.id} className="flex items-center gap-2.5 py-2 text-[13px]">
                        <Shield className="h-4 w-4 shrink-0 text-muted" />
                        <Link to={rolePath(role.id)} className="min-w-0 flex-1 truncate font-medium text-ink hover:text-blue">{role.name}</Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">
                    {user.type === USER_TYPE.ADMIN ? 'No roles — admins see every document regardless.' : 'No roles, so no documents.'}
                  </p>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default UserDetail;
