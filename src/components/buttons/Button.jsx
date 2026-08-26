import { Loader2 } from 'lucide-react';
import cn from '../../utils/cn';

const VARIANTS = {
  primary: 'bg-blue text-white hover:bg-blue-dk disabled:hover:bg-blue',
  secondary: 'bg-surface text-ink border border-border-2 hover:bg-surface-2',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-red text-white hover:opacity-90',
};

const SIZES = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-9 w-9',
};

/**
 * The one button (§3.3). `loading` implies disabled so a double-submit is
 * impossible without every caller remembering to wire it.
 */
const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className,
  children,
  ...props
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-(--radius-sm) font-medium',
      'transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
      VARIANTS[variant],
      SIZES[size],
      className
    )}
    {...props}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    {children}
  </button>
);

export default Button;
