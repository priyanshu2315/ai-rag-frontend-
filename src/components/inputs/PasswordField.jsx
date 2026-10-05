import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import cn from '../../utils/cn';
import Field from './Field';

/** Text field plus a show/hide toggle (§8.1). */
const PasswordField = ({ label, error, hint, required, className, ...props }) => {
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          className={cn(
            'h-10 w-full rounded-(--radius-sm) border bg-surface pl-3 pr-10 text-base text-ink sm:text-sm',
            'placeholder:text-muted-2 transition-colors',
            'focus:outline-none focus:border-blue focus:ring-2 focus:ring-blue-lt',
            error ? 'border-red' : 'border-border-2'
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((shown) => !shown)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted hover:text-ink"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
};

export default PasswordField;
