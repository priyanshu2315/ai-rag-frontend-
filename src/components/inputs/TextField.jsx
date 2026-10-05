import { useId } from 'react';
import cn from '../../utils/cn';
import Field from './Field';

/**
 * Controlled text input (§8.1). Takes `value/onChange/onBlur/error` exactly,
 * so an RHF `field` object spreads straight in.
 */
const TextField = ({
  label,
  error,
  hint,
  required,
  type = 'text',
  className,
  inputClassName,
  ...props
}) => {
  const id = useId();

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <input
        id={id}
        type={type}
        aria-invalid={Boolean(error)}
        className={cn(
          'h-10 w-full rounded-(--radius-sm) border bg-surface px-3 text-base text-ink sm:text-sm',
          'placeholder:text-muted-2 transition-colors',
          'focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue-lt',
          error ? 'border-red' : 'border-border-2',
          inputClassName
        )}
        {...props}
      />
    </Field>
  );
};

export default TextField;
