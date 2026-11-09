import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, Moon, Route as RouteIcon, Sun } from 'lucide-react';
import ConfirmDialog from '../feedback/ConfirmDialog';
import Modal from '../modals/Modal';
import ChangePasswordForm from '../forms/ChangePasswordForm';
import useAuth from '../../hooks/useAuth';
import useTheme from '../../hooks/useTheme';
import { ROUTES } from '../../constants/routes';
import { USER_TYPE } from '../../constants/permissions';
import { initialsOf } from '../../utils/format';
import cn from '../../utils/cn';

const itemClass =
  'flex w-full items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-2 text-left text-[13px] text-ink-2 hover:bg-surface-2 hover:text-ink';

/**
 * Who is signed in and what they can do about it: account details, change
 * password, theme, "How it works", sign out.
 */
const UserMenu = () => {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(null); // 'password' | 'signout' | null
  const rootRef = useRef(null);
  const menuId = useId();

  // `name` is null on older accounts — the email stands in for it.
  const displayName = user?.name || user?.email || 'Account';
  const isAdmin = user?.type === USER_TYPE.ADMIN;

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const choose = (action) => () => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        // Flat on the header — no border or fill; a soft background on hover
        // (and while open) is all that marks it as a button.
        className={cn(
          'flex h-11 items-center gap-2 rounded-(--radius) py-1 pr-2 pl-1 text-header-ink transition-colors hover:bg-surface-2',
          open && 'bg-surface-2'
        )}
      >
        <span className="grid h-8 w-8 place-items-center rounded-(--radius-sm) bg-sb text-[12px] font-bold text-sb-accent">
          {initialsOf(user ?? {})}
        </span>
        <span className="hidden max-w-[160px] truncate text-[13px] font-medium sm:block">{displayName}</span>
        <ChevronDown className={cn('h-4 w-4 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute top-[calc(100%+6px)] right-0 z-40 w-64 rounded-(--radius) border border-border bg-surface p-1.5 shadow-(--sh-lg)"
        >
          <div className="border-b border-border px-2.5 pt-1.5 pb-2.5">
            <p className="truncate text-[13px] font-semibold text-ink">{displayName}</p>
            {user?.name && <p className="truncate text-[12px] text-muted">{user.email}</p>}
            <span
              className={cn(
                'mono mt-1.5 inline-block rounded px-2 py-0.5 text-[11px] font-medium',
                isAdmin ? 'bg-blue-lt text-blue-dk' : 'bg-chip text-muted'
              )}
            >
              {isAdmin ? 'Admin' : 'User'}
            </span>
          </div>

          <div className="pt-1.5">
            <button type="button" role="menuitem" className={itemClass} onClick={choose(() => setDialog('password'))}>
              <KeyRound className="h-4 w-4" /> Change password
            </button>
            <button type="button" role="menuitem" className={itemClass} onClick={choose(toggle)}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light theme' : 'Dark theme'}
            </button>
            <button type="button" role="menuitem" className={itemClass} onClick={choose(() => navigate(ROUTES.ABOUT))}>
              <RouteIcon className="h-4 w-4" /> How it works
            </button>
            <button
              type="button"
              role="menuitem"
              className={cn(itemClass, 'text-red hover:text-red')}
              onClick={choose(() => setDialog('signout'))}
            >
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        </div>
      )}

      {dialog === 'password' && (
        <Modal title="Change password" description="You'll stay signed in." onClose={() => setDialog(null)}>
          <ChangePasswordForm onDone={() => setDialog(null)} onCancel={() => setDialog(null)} />
        </Modal>
      )}

      {dialog === 'signout' && (
        <ConfirmDialog
          title="Log out?"
          message="You'll need to sign in again to reach your documents and chats."
          confirmLabel="Log out"
          onConfirm={signOut}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default UserMenu;
