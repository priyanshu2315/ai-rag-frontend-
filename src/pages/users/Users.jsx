import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { KeyRound, Pencil, Plus, Power, Search, Users as UsersIcon } from 'lucide-react';
import PageHead from '../../components/layout/PageHead';
import { Badge } from '../../components/badges/StatusBadge';
import EmptyState from '../../components/feedback/EmptyState';
import ErrorState from '../../components/feedback/ErrorState';
import { TableRowsSkeleton } from '../../components/feedback/Skeletons';
import ConfirmDialog from '../../components/feedback/ConfirmDialog';
import ResetPasswordDialog from '../../components/users/ResetPasswordDialog';
import { useUsers } from '../../hooks/useUsers';
import useDebounce from '../../hooks/useDebounce';
import usePageTitle from '../../hooks/usePageTitle';
import { ROUTES, userPath } from '../../constants/routes';
import { USER_TYPE } from '../../constants/permissions';
import cn from '../../utils/cn';

const HEAD = 'mono whitespace-nowrap px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.06em] text-muted';
const iconButton = 'inline-flex h-9 w-9 items-center justify-center rounded-(--radius-sm) text-muted transition-colors hover:bg-chip hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-muted';
const primaryLink = 'inline-flex h-9 items-center gap-2 rounded-(--radius-sm) bg-blue-solid px-3 text-[13px] font-semibold text-white transition-colors hover:bg-blue-solid-hover';
const MAX_ROLE_CHIPS = 3;

const RoleChips = ({ roles = [] }) => {
  if (roles.length === 0) return <span className="text-[12px] text-muted">No roles</span>;
  const shown = roles.slice(0, MAX_ROLE_CHIPS);
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((role) => (
        <span key={role.id} className="max-w-36 truncate rounded bg-chip px-1.5 py-0.5 text-[11.5px] text-ink-2">{role.name}</span>
      ))}
      {roles.length > shown.length && (
        <span className="mono rounded px-1 py-0.5 text-[11px] text-muted" title={roles.slice(MAX_ROLE_CHIPS).map((role) => role.name).join(', ')}>
          +{roles.length - shown.length}
        </span>
      )}
    </div>
  );
};

/**
 * Admin module: every account, searchable by name or email. The search is
 * the URL's `?search=` (§6) so a refresh or shared link reproduces the view;
 * typing updates it after a 300ms pause.
 */
const Users = () => {
  usePageTitle('Users');
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const [draft, setDraft] = useState(search);
  const debounced = useDebounce(draft, 300);
  const { users, loaded, loading, error, reload, actingId, setActive, resetPassword } = useUsers(search);
  const myId = useSelector((state) => state.auth.user?.userId);
  const [disabling, setDisabling] = useState(null);
  const [resetting, setResetting] = useState(null);

  // Typing → URL, once it settles. The URL is what drives the request.
  useEffect(() => {
    const next = debounced.trim();
    if (next === search) return;
    setParams((current) => {
      const updated = new URLSearchParams(current);
      if (next) updated.set('search', next);
      else updated.delete('search');
      return updated;
    }, { replace: true });
  }, [debounced, search, setParams]);

  const confirmDisable = async () => {
    if (await setActive(disabling, false)) setDisabling(null);
  };

  return (
    <>
      <PageHead
        title="Users"
        subtitle="Accounts, their type and the roles that decide what they can see"
        actions={<Link to={ROUTES.USER_NEW} className={primaryLink}><Plus className="h-4 w-4" /> New user</Link>}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:px-6">
          <label className="flex min-h-11 items-center gap-2 rounded-(--radius) border border-input-border bg-surface px-3 text-muted focus-within:border-blue sm:max-w-sm">
            <Search className="h-4 w-4 shrink-0" />
            <span className="sr-only">Search users by name or email</span>
            <input
              type="search"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Search name or email…"
              className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-2 sm:text-[13.5px]"
            />
          </label>

          {error && users.length === 0 ? (
            <ErrorState message={error} onRetry={reload} />
          ) : loaded && !loading && users.length === 0 ? (
            <EmptyState
              icon={search ? Search : UsersIcon}
              title={search ? 'No matching users' : 'No users yet'}
              description={search ? `Nobody's name or email contains “${search}”.` : 'Create an account and give it roles.'}
            />
          ) : (
            <div className="overflow-x-auto rounded-(--radius) border border-border bg-surface">
              <table className="w-full border-collapse text-[13px]" aria-busy={loading}>
                <thead className="bg-bg">
                  <tr>
                    <th scope="col" className={`${HEAD} text-right`}>S.No.</th>
                    <th scope="col" className={`${HEAD} w-1/3`}>User</th>
                    <th scope="col" className={`${HEAD} hidden sm:table-cell`}>Type</th>
                    <th scope="col" className={HEAD}>Status</th>
                    <th scope="col" className={`${HEAD} hidden md:table-cell`}>Roles</th>
                    <th scope="col" className={HEAD}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className={cn(loading && loaded && 'opacity-60 transition-opacity')}>
                  {loading && !loaded
                    ? (
                      <TableRowsSkeleton
                        actionCount={3}
                        columns={['num', 'title', { type: 'badge', className: 'hidden sm:table-cell' }, 'badge', { type: 'text', className: 'hidden md:table-cell' }, 'actions']}
                      />
                    )
                    : users.map((user, index) => {
                        const isMe = user.id === myId;
                        const busy = actingId === user.id;
                        return (
                          <tr key={user.id} className="border-t border-border align-top hover:bg-surface-2">
                            <td className="mono w-px whitespace-nowrap px-3 py-2 text-right text-[12px] text-muted">{index + 1}</td>
                            <td className="max-w-0 px-3 py-2">
                              <Link to={userPath(user.id)} className="block truncate font-medium text-ink hover:text-blue">
                                {user.name || user.email}{isMe && <span className="font-normal text-muted"> (you)</span>}
                              </Link>
                              <p className="truncate text-[12px] text-muted">{user.email}</p>
                              {/* Phones drop the Type column to fit S.No. and the actions. */}
                              {user.type === USER_TYPE.ADMIN && (
                                <span className="mt-1 inline-block sm:hidden"><Badge tone="working">Admin</Badge></span>
                              )}
                            </td>
                            <td className="hidden px-3 py-2 sm:table-cell">
                              <Badge tone={user.type === USER_TYPE.ADMIN ? 'working' : 'idle'}>
                                {user.type === USER_TYPE.ADMIN ? 'Admin' : 'User'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <Badge tone={user.isActive ? 'ready' : 'failed'}>{user.isActive ? 'Active' : 'Disabled'}</Badge>
                              {user.isActive && user.mustChangePassword && (
                                <p className="mt-1 text-[11.5px] whitespace-nowrap text-muted">Temporary password</p>
                              )}
                            </td>
                            <td className="hidden px-3 py-2 md:table-cell"><RoleChips roles={user.roles} /></td>
                            <td className="px-2 py-1">
                              <div className="flex justify-end gap-0.5">
                                <Link to={userPath(user.id)} className={iconButton} aria-label={`Edit ${user.email}`} title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </Link>
                                <button
                                  type="button"
                                  className={iconButton}
                                  onClick={() => setResetting(user)}
                                  disabled={busy}
                                  aria-label={`Reset password for ${user.email}`}
                                  title="Reset password"
                                >
                                  <KeyRound className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  className={cn(iconButton, user.isActive ? 'hover:bg-red-bg hover:text-red' : 'hover:bg-green-bg hover:text-green')}
                                  onClick={() => (user.isActive ? setDisabling(user) : setActive(user, true))}
                                  // The backend refuses this for your own account; so does the UI.
                                  disabled={busy || isMe}
                                  aria-label={`${user.isActive ? 'Disable' : 'Enable'} ${user.email}`}
                                  title={isMe ? "You can't disable your own account" : user.isActive ? 'Disable account' : 'Enable account'}
                                >
                                  <Power className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {disabling && (
        <ConfirmDialog
          title={`Disable ${disabling.name || disabling.email}?`}
          message="They are signed out on their next request and can't sign in until you enable the account again. Their roles are kept."
          confirmLabel="Disable account"
          loading={actingId === disabling.id}
          onConfirm={confirmDisable}
          onCancel={() => setDisabling(null)}
        />
      )}

      {resetting && (
        <ResetPasswordDialog
          user={resetting}
          saving={actingId === resetting.id}
          onReset={resetPassword}
          onClose={() => setResetting(null)}
        />
      )}
    </>
  );
};

export default Users;
