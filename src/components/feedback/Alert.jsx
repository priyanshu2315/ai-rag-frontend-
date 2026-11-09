import { AlertTriangle, Info } from 'lucide-react';
import cn from '../../utils/cn';

const VARIANTS = {
  error: { icon: AlertTriangle, className: 'border-red/30 bg-red-bg text-red' },
  info: { icon: Info, className: 'border-blue/25 bg-blue-lt text-blue-dk' },
  warning: { icon: AlertTriangle, className: 'border-amber/30 bg-amber-bg text-amber' },
};

/** An inline message inside a form or panel — for errors the form owns, not toasts. */
const Alert = ({ variant = 'error', title, children, className }) => {
  const { icon: Icon, className: tone } = VARIANTS[variant];

  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-(--radius-sm) border px-3 py-2.5 text-[13px]', tone, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-ink-2')}>{children}</div>}
      </div>
    </div>
  );
};

export default Alert;
