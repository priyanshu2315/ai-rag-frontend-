import { useId, useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import cn from '../../utils/cn';
import Field from './Field';
import Skeleton from '../feedback/Skeleton';
import { filterByQuery } from '../../utils/match';

/**
 * Controlled multi-select (§8.1 checkbox group) with a filter, for picking
 * documents for a role or roles for a user. `value` is an array of ids and
 * `onChange` receives the full new array — the backend's PUT endpoints
 * replace the whole list, so the field always holds the whole selection.
 *
 * `options` is `[{ value, label, meta? }]`; `meta` is a small trailing node
 * (a status badge, a count).
 */
const MultiSelectField = ({
  label, hint, error, options, value = [], onChange, onBlur, loading = false,
  emptyText = 'Nothing to choose from yet.', searchPlaceholder = 'Filter…', disabled = false,
}) => {
  const id = useId();
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);

  const visible = useMemo(() => filterByQuery(options, query, (option) => option.label), [options, query]);

  const toggle = (optionValue) => {
    const next = selected.has(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue];
    onChange(next);
  };

  const chosen = options.filter((option) => selected.has(option.value));

  return (
    <Field label={label} htmlFor={id} error={error} hint={hint}>
      <div
        className={cn(
          'overflow-hidden rounded-(--radius-sm) border bg-surface',
          error ? 'border-red' : 'border-input-border',
          disabled && 'opacity-60'
        )}
        onBlur={onBlur}
      >
        {chosen.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-border bg-surface-2 px-2.5 py-2">
            {chosen.map((option) => (
              <span key={option.value} className="inline-flex max-w-full items-center gap-1 rounded bg-blue-lt py-0.5 pr-1 pl-2 text-[12px] text-blue-dk">
                <span className="truncate">{option.label}</span>
                <button
                  type="button"
                  onClick={() => toggle(option.value)}
                  disabled={disabled}
                  aria-label={`Remove ${option.label}`}
                  className="grid h-5 w-5 place-items-center rounded hover:bg-blue/15"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        <label className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 shrink-0 text-muted" />
          <span className="sr-only">{`Filter ${label ?? 'options'}`}</span>
          <input
            id={id}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            disabled={disabled}
            className="h-10 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted-2 sm:text-[13px]"
          />
          <span className="mono shrink-0 text-[11px] text-muted">{value.length} selected</span>
        </label>

        <ul role="listbox" aria-multiselectable="true" aria-label={label} className="max-h-64 overflow-y-auto py-1">
          {loading && options.length === 0 ? (
            Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="px-3 py-1.5"><Skeleton className="h-6 w-full" /></li>
            ))
          ) : visible.length === 0 ? (
            <li className="px-3 py-3 text-[12.5px] text-muted">{options.length === 0 ? emptyText : 'No matches.'}</li>
          ) : (
            visible.map((option) => {
              const isOn = selected.has(option.value);
              return (
                <li key={option.value} role="option" aria-selected={isOn}>
                  <button
                    type="button"
                    onClick={() => toggle(option.value)}
                    disabled={disabled}
                    className="flex min-h-10 w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] text-ink hover:bg-surface-2"
                  >
                    <span
                      className={cn(
                        'grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border',
                        isOn ? 'border-blue-solid bg-blue-solid text-white' : 'border-input-border bg-surface'
                      )}
                    >
                      {isOn && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.meta}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </Field>
  );
};

export default MultiSelectField;
