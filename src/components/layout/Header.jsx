import { Menu } from 'lucide-react';
import UserMenu from './UserMenu';

/**
 * The global header: a plain white 56px bar with a hairline border and no
 * shadow, so the navy sidebar stays the one strong frame. It holds only the account menu (and, on narrow
 * screens, the button that opens the sidebar) — every module carries its own
 * actions in its `PageHead`, and new chats start from "New chat".
 */
const Header = ({ onOpenMenu }) => (
  <header className="flex h-(--topbar-h) shrink-0 items-center gap-2 border-b border-header-border bg-header px-3 text-header-ink sm:px-6">
    <button
      type="button"
      onClick={onOpenMenu}
      aria-label="Open menu"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-(--radius) text-header-ink hover:bg-surface-2 lg:hidden"
    >
      <Menu className="h-5 w-5" />
    </button>

    <div className="ml-auto shrink-0">
      <UserMenu />
    </div>
  </header>
);

export default Header;
