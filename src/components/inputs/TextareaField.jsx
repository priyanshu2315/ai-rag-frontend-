import { useId } from 'react';
import cn from '../../utils/cn';
import Field from './Field';

/** Controlled textarea (§8.1) — same `value/onChange/onBlur/error` contract. */
const TextareaField = ({
  label,
  error,
  hint,
  required,
  rows = 3,
  className,
  inputClassName,
  ...props
}) => {
  const id = useId();

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={cn(
          'w-full resize-none rounded-(--radius-sm) border bg-surface px-3 py-2 text-sm text-ink',
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

export default TextareaField;
