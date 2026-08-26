import cn from '../../utils/cn';

/** Every data surface gets one of these instead of rendering nothing (§12). */
const EmptyState = ({ icon: Icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
    {Icon && (
      <div className="mb-4 rounded-full bg-blue-lt p-4">
        <Icon className="h-7 w-7 text-blue" />
      </div>
    )}
    <p className="font-display text-base font-semibold text-ink">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
