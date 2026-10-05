import { useState } from 'react';
import { ArrowLeft, LogOut, Menu, Route as RouteIcon } from 'lucide-react';
import { useMatch, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import { ROUTES } from '../../constants/routes';
import { initialsFromEmail } from '../../utils/format';
import Button from '../buttons/Button';
import ThemeToggle from '../buttons/ThemeToggle';
import ConfirmDialog from '../feedback/ConfirmDialog';

/** Page context and controls; actions move to a second row on narrow screens. */
const Topbar = ({ title, subtitle, actions, onOpenDocuments }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  // The same control both ways, so About is never a page you can only leave
  // with the browser's back button.
  const onAbout = Boolean(useMatch(ROUTES.ABOUT));

  return (
    <header className="flex min-h-(--topbar-h) shrink-0 flex-wrap items-center gap-x-2 border-b border-border bg-surface px-3 xl:h-(--topbar-h) xl:flex-nowrap xl:px-5">
      {onOpenDocuments && (
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 lg:hidden"
          onClick={onOpenDocuments}
          aria-label="Open documents"
          title="Open documents"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-display text-[15px] font-semibold text-ink">{title}</h2>
        {subtitle && <p className="truncate text-[12px] text-muted">{subtitle}</p>}
      </div>

      <div className="order-3 flex w-full items-center justify-end gap-1 overflow-x-auto pb-1 empty:hidden xl:order-none xl:w-auto xl:overflow-visible xl:pb-0">
        {actions}
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 shrink-0 px-2 sm:px-3 xl:h-8"
          onClick={() => navigate(onAbout ? ROUTES.CHAT : ROUTES.ABOUT)}
          title={onAbout ? 'Back to chat' : 'How this works'}
        >
          {onAbout ? <ArrowLeft className="h-4 w-4" /> : <RouteIcon className="h-4 w-4" />}
          <span className="hidden sm:inline">{onAbout ? 'Back to chat' : 'How it works'}</span>
        </Button>

        <ThemeToggle className="h-10 w-10 shrink-0 xl:h-8 xl:w-8" />

        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-lt text-[11px] font-semibold text-blue">
            {initialsFromEmail(user?.email)}
          </span>
          <span className="max-w-[180px] truncate text-[13px] text-ink-2">{user?.email}</span>
        </div>

        <Button variant="ghost" size="sm" className="h-10 shrink-0 px-2 sm:px-3 xl:h-8" onClick={() => setConfirmingSignOut(true)} title="Sign out" aria-label="Sign out">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
      {confirmingSignOut && (
        <ConfirmDialog
          title="Sign out?"
          message="You'll need to sign in again to access your documents and chats."
          confirmLabel="Sign out"
          onConfirm={signOut}
          onCancel={() => setConfirmingSignOut(false)}
        />
      )}
    </header>
  );
};

export default Topbar;
