import { BrainCircuit } from 'lucide-react';
import ThemeToggle from '../buttons/ThemeToggle';

/**
 * Bare shell for /login and /register — no sidebar, no topbar (§4). The theme
 * toggle sits in the corner instead, so it is reachable before signing in.
 */
const AuthLayout = ({ title, subtitle, children, footer }) => (
  <div className="relative flex min-h-dvh items-center justify-center bg-bg px-4 py-12">
    <ThemeToggle className="absolute top-3 right-3" />
    <div className="w-full max-w-[400px]">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 rounded-(--radius-lg) bg-navy p-3">
          <BrainCircuit className="h-7 w-7 text-white" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      <div className="rounded-(--radius-lg) border border-border bg-surface p-4 shadow-(--sh) sm:p-6">
        {children}
      </div>

      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  </div>
);

export default AuthLayout;
