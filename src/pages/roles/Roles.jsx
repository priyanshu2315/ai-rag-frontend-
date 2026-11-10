import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { TableRowsSkeleton } from '../../components/feedback/Skeletons';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import { useRoles } from '../../hooks/useRoles';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, rolePath } from '../../constants/routes';
import { roleDeleteMessage } from '../../utils/roles';

const HEAD = 'mono whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted';
const iconLink = 'inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-chip hover:text-ink';
const primaryLink = 'inline-flex h-9 items-center gap-2 rounded-(--radius-sm) bg-blue-solid px-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-solid-hover';

/** Admin module: every role with its document and user counts. */
const Roles = () => {
  usePageTitle('Roles');
  const { roles, loaded, loading, error, deletingId, reload, remove } = useRoles();
  const [deleting, setDeleting] = useState(null);

  const confirmDelete = async () => {
    if (await remove(deleting)) setDeleting(null);
  };

  return (
    <>
      <PageHead
        title="Roles"
        subtitle="Each role is a set of documents; users see the documents in their roles"
        actions={<Link to={ROUTES.ROLE_NEW} className={primaryLink}><Plus className="h-4 w-4" /> New role</Link>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
          {error && roles.length === 0 ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loaded && roles.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No roles yet"
              description="Create a role, add documents to it, then give it to users so they can see those documents."
              action={<Link to={ROUTES.ROLE_NEW} className={primaryLink}><Plus className="h-4 w-4" /> New role</Link>}
            />
          ) : (
            <div className="overflow-x-auto rounded-(--radius) border border-border bg-surface">
              <table className="w-full border-collapse text-[13px]" aria-busy={loading && !loaded}>
                <thead className="bg-bg">
                  <tr>
                    <th scope="col" className={`${HEAD} text-right`}>S.No.</th>
                    <th scope="col" className={`${HEAD} w-full`}>Role</th>
                    <th scope="col" className={`${HEAD} text-right`}>Documents</th>
                    <th scope="col" className={`${HEAD} text-right`}>Users</th>
                    <th scope="col" className={HEAD}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !loaded
                    ? <TableRowsSkeleton rows={4} actionCount={2} columns={['num', 'title', 'num', 'num', 'actions']} />
                    : roles.map((role, index) => (
                        <tr key={role.id} className="border-t border-border hover:bg-surface-2">
                          <td className="mono w-px whitespace-nowrap px-3 py-2 text-right text-[12px] text-muted">{index + 1}</td>
                          <td className="max-w-0 px-3 py-2">
                            <Link to={rolePath(role.id)} className="block truncate font-medium text-ink hover:text-blue">{role.name}</Link>
                            {role.description && <p className="truncate text-[12px] text-muted">{role.description}</p>}
                          </td>
                          <td className="mono px-3 py-2 text-right">{role.documentCount ?? 0}</td>
                          <td className="mono px-3 py-2 text-right">{role.userCount ?? 0}</td>
                          <td className="px-2 py-1">
                            <div className="flex justify-end gap-0.5">
                              <Link to={rolePath(role.id)} className={iconLink} aria-label={`Edit ${role.name}`} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Link>
                              <button
                                type="button"
                                onClick={() => setDeleting(role)}
                                disabled={deletingId === role.id}
                                className={`${iconLink} hover:bg-red-bg hover:text-red`}
                                aria-label={`Delete ${role.name}`}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Delete “${deleting.name}”?`}
          message={roleDeleteMessage(deleting)}
          confirmLabel="Delete role"
          loading={deletingId === deleting.id}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
};

export default Roles;
