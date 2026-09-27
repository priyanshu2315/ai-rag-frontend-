import { ArrowLeft, LogOut, Route as RouteIcon } from 'lucide-react';
import { useMatch, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { initialsFromEmail } from '../../utils/format';
import Button from '../buttons/Button';
import ThemeToggle from '../buttons/ThemeToggle';

/** Fixed 60px topbar (§4): page context on the left, member on the right. */
const Topbar = ({ title, subtitle, actions }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  // The same control both ways, so About is never a page you can only leave
  // with the browser's back button.
  const onAbout = Boolean(useMatch(ROUTES.ABOUT));

  return (
    <header className="flex h-(--topbar-h) shrink-0 items-center justify-between border-b border-border bg-surface px-5">
      <div className="min-w-0">
        <h2 className="truncate font-display text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="truncate text-[12px] text-muted">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(onAbout ? ROUTES.CHAT : ROUTES.ABOUT)}
          title={onAbout ? 'Back to chat' : 'How this works'}
        >
          {onAbout ? <ArrowLeft className="h-4 w-4" /> : <RouteIcon className="h-4 w-4" />}
          <span className="hidden sm:inline">{onAbout ? 'Back to chat' : 'How it works'}</span>
        </Button>

        <ThemeToggle className="h-8 w-8" />

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
