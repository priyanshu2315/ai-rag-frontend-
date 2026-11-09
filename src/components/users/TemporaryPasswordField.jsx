import { useId } from 'react';
import { RefreshCw } from 'lucide-react';
import cn from '../../utils/cn';
import Field from '../inputs/Field';
import { generateTemporaryPassword } from '../../utils/password';

/**
 * Temporary password input with a Generate button. Shown in plain text on
 * purpose: the admin has to read it out or paste it to the user.
 */
const TemporaryPasswordField = ({ label = 'Temporary password', error, hint, value, onChange, onBlur, name, ref }) => {
  const id = useId();

  return (
    <Field
      label={label}
      htmlFor={id}
      error={error}
      hint={hint ?? "At least 8 characters. It's emailed to the user, who must change it at first sign-in."}
      required
    >
      <div className="flex gap-2">
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          className={cn(
            'mono h-10 min-w-0 flex-1 rounded-(--radius-sm) border bg-surface px-3 text-base text-ink sm:text-sm',
            'focus:border-blue focus:ring-2 focus:ring-blue-lt focus:outline-none',
            error ? 'border-red' : 'border-input-border'
          )}
        />
        <button
          type="button"
          onClick={() => onChange(generateTemporaryPassword())}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-(--radius-sm) border border-border-2 bg-surface px-3 text-[13px] font-medium text-ink hover:bg-surface-2"
        >
          <RefreshCw className="h-4 w-4" /> Generate
        </button>
      </div>
    </Field>
  );
};

export default TemporaryPasswordField;
