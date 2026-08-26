import cn from '../../utils/cn';

/**
 * Label + control + error, shared by every field component so spacing and
 * error styling are defined once.
 */
const Field = ({ label, htmlFor, error, hint, required, className, children }) => (
  <div className={cn('space-y-1.5', className)}>
    {label && (
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="text-red"> *</span>}
      </label>
    )}

    {children}

    {error ? (
      <p className="text-[12px] text-red">{error}</p>
    ) : (
      hint && <p className="text-[12px] text-muted">{hint}</p>
    )}
  </div>
);

export default Field;
