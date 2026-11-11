import { useEffect, useRef } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router-dom';
import { Loader2, MessageSquarePlus, X } from 'lucide-react';
import { NAV_SECTIONS } from '../../constants/nav';
import usePermission from '../../hooks/usePermission';
import useStartChat from '../../hooks/useStartChat';
import cn from '../../utils/cn';
import BatLogo from './BatLogo';

const FOCUSABLE = 'a[href], button:not(:disabled)';

const linkClass = (active) =>
  cn(
    'flex items-center gap-2.5 rounded-(--radius-sm) px-2.5 py-2 text-[13.5px] text-sb-text no-underline transition-colors',
    active
      ? 'bg-sb-active text-white shadow-[inset_2px_0_0_var(--color-sb-accent)]'
      : 'hover:bg-sb-raised'
  );

/** A module link that also stays lit on the routes nested under it. */
const ModuleLink = ({ item, pathname, onNavigate }) => {
  const Icon = item.icon;
  const nested = (item.match ?? []).some((pattern) => matchPath(pattern, pathname));

  return (
    <NavLink
      to={item.to}
      end
      onClick={onNavigate}
      className={({ isActive }) => linkClass(isActive || nested)}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
};

/**
 * The module sidebar: New chat, then one link per module. Admin modules sit
 * at the bottom and only render for accounts that hold their permission.
 *
 * On narrow screens the same sidebar opens as a drawer from the header's menu
 * button; `mobile` adds the dialog semantics and keeps Tab inside it.
 */
const Sidebar = ({ mobile = false, onClose, className }) => {
  const sidebarRef = useRef(null);
  const { can } = usePermission();
  const { pathname } = useLocation();
  const { start, creating } = useStartChat();

  useEffect(() => {
    if (!mobile) return undefined;
    const previousFocus = document.activeElement;
    sidebarRef.current?.querySelector(FOCUSABLE)?.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = [...sidebarRef.current.querySelectorAll(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobile, onClose]);

  const sections = NAV_SECTIONS
    .map((section) => ({ ...section, items: section.items.filter((item) => !item.requires || can(item.requires)) }))
    .filter((section) => section.items.length > 0);

  // Creates the chat, then opens it (backend Step 13 flow).
  const startChat = async () => {
    if (await start()) onClose?.();
  };

  return (
    <aside
      ref={sidebarRef}
      role={mobile ? 'dialog' : undefined}
      aria-modal={mobile || undefined}
      aria-label="Modules"
      className={cn(
        'sb-scroll flex h-dvh w-(--sidebar-w) shrink-0 flex-col gap-4 overflow-y-auto bg-sb px-2.5 py-4 text-sb-text',
        mobile && 'absolute inset-y-0 left-0 w-[min(17rem,calc(100vw-3rem))] shadow-(--sh-lg)',
        className
      )}
    >
      <div className="mb-5 flex items-center gap-2.5 px-2">
        <BatLogo className="w-36 shrink-0 bg-[#FFFFFF]" />
        <span className="sr-only">Batman</span>
        {mobile && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-(--radius-sm) text-sb-label hover:bg-sb-raised hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={startChat}
        disabled={creating}
        className="flex min-h-11 items-center gap-2.5 rounded-(--radius) border border-sb-border bg-sb-raised px-3 font-medium text-white transition-colors hover:bg-sb-active"
      >
        {creating
          ? <Loader2 className="h-4 w-4 animate-spin text-sb-accent" />
          : <MessageSquarePlus className="h-4 w-4 text-sb-accent" />}
        New chat
      </button>

      {sections.map((section) => (
        <nav
          key={section.label}
          aria-label={section.label}
          className={cn(
            'flex flex-col gap-px',
            section.admin && 'mt-auto border-t border-sb-border pt-3'
          )}
        >
          <p className="mono px-2.5 pb-1.5 text-[10.5px] uppercase tracking-[0.1em] text-sb-label">
            {section.label}
          </p>
          {section.items.map((item) => (
            <ModuleLink key={item.to} item={item} pathname={pathname} onNavigate={onClose} />
          ))}
        </nav>
      ))}
    </aside>
  );
};

export default Sidebar;
