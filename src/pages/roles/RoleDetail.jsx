import { Link, useParams } from 'react-router-dom';
import { FileText, Pencil, User } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import { DocumentStatusBadge } from '../../components/badges/StatusBadge';
import ErrorState from '../../components/feedback/ErrorState';
import { FormSkeleton, TextSkeleton } from '../../components/feedback/Skeletons';
import { useRoleEditor } from '../../hooks/useRoles';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, roleEditPath, userPath } from '../../constants/routes';
import { formatDate } from '../../utils/format';

const primaryLink = 'inline-flex h-9 items-center gap-2 rounded-(--radius-sm) bg-blue-solid px-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-solid-hover';

const Section = ({ title, count, children }) => (
  <section className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
    <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-4 py-2.5">
      <h2 className="flex-1 text-[13.5px] font-semibold">{title}</h2>
      <span className="mono text-[11px] text-muted">{count}</span>
    </div>
    <div className="p-4">{children}</div>
  </section>
);

/** Admin module page: a role at a glance (`/roles/:roleId`). Editing is one click away. */
const RoleDetail = () => {
  const { roleId } = useParams();
  const { role, loading, error, reload } = useRoleEditor(roleId);
  usePageTitle(role?.name ?? 'Role');
  const documents = role?.documents ?? [];
  const users = role?.users ?? [];

  return (
    <>
      <PageHead
        crumbs={[{ label: 'Roles', to: ROUTES.ROLES }]}
        title={role?.name ?? <TextSkeleton className="h-4 w-36" />}
        subtitle={role ? role.description || 'No description' : undefined}
        actions={role && (
          <Link to={roleEditPath(roleId)} className={primaryLink}>
            <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Edit role</span><span className="sm:hidden">Edit</span>
          </Link>
        )}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-5 sm:px-6">
          {error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loading ? (
            <FormSkeleton sections={['list', 'list']} />
          ) : (
            <>
              <Section title="Documents" count={documents.length}>
                {documents.length ? (
                  <ul className="-my-2 divide-y divide-border">
                    {documents.map((doc) => (
                      <li key={doc.id} className="flex items-center gap-2.5 py-2 text-[13px]">
                        <FileText className="h-4 w-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1 truncate font-medium text-ink" title={doc.filename}>{doc.filename}</span>
                        {doc.status && <DocumentStatusBadge status={doc.status} />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-muted">No documents in this role yet.</p>
                )}
              </Section>

              <Section title="Users with this role" count={users.length}>
                {users.length ? (
                  <ul className="-my-2 divide-y divide-border">
                    {users.map((user) => (
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
                  <p className="text-[13px] text-muted">Nobody has this role yet.</p>
                )}
              </Section>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default RoleDetail;
