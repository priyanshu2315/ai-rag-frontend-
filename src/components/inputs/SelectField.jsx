import { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import cn from '../../utils/cn';
import Field from './Field';

/**
 * Controlled single select (§8.1), native under the hood so keyboard and
 * mobile pickers work for free. `options` is `[{ value, label }]`.
 */
const SelectField = forwardRef(({ label, error, hint, required, options, className, ...props }, ref) => {
  const id = useId();

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <select
          ref={ref}
          id={id}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-10 w-full appearance-none rounded-(--radius-sm) border bg-surface pr-9 pl-3 text-base text-ink sm:text-sm',
            'transition-colors focus:border-blue focus:ring-2 focus:ring-blue-lt focus:outline-none',
            'disabled:cursor-not-allowed disabled:opacity-60',
            error ? 'border-red' : 'border-input-border'
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </Field>
  );
});
SelectField.displayName = 'SelectField';

export default SelectField;
