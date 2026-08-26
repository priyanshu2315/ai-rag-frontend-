import { LogOut } from 'lucide-react';
import useAuth from '../../hooks/useAuth';
import { initialsFromEmail } from '../../utils/format';
import Button from '../buttons/Button';

/** Fixed 60px topbar (§4): page context on the left, member on the right. */
const Topbar = ({ title, subtitle }) => {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-(--topbar-h) shrink-0 items-center justify-between border-b border-border bg-surface px-5">
      <div className="min-w-0">
        <h2 className="truncate font-display text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="truncate text-[12px] text-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-lt text-[11px] font-semibold text-blue">
            {initialsFromEmail(user?.email)}
          </span>
          <span className="max-w-[180px] truncate text-[13px] text-ink-2">{user?.email}</span>
        </div>

        <Button variant="ghost" size="sm" onClick={signOut} title="Sign out">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
};

export default Topbar;
