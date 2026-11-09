import Skeleton from './Skeleton';
import cn from '../../utils/cn';

/**
 * Shimmer layouts shaped like the content they stand in for, so the page does
 * not jump when the data lands (§12). Each group carries one `role="status"`
 * so assistive tech hears "Loading" once rather than once per bar.
 */

// Varied widths make a placeholder read as text, not as a striped block.
const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-3/5'];
const widthAt = (index) => WIDTHS[index % WIDTHS.length];

const LoadingLabel = ({ label = 'Loading' }) => <span className="sr-only">{label}</span>;

/** A title-sized bar for a heading or subtitle whose text is still loading. */
export const TextSkeleton = ({ className }) => (
  <span role="status" className="inline-flex align-middle">
    <Skeleton as="span" className={cn('inline-block h-3.5 w-40', className)} />
    <LoadingLabel />
  </span>
);

/**
 * Table body rows. `columns` describes each cell:
 *   'text'   — a line of text (width varies by row)
 *   'title'  — a primary line with a smaller line under it
 *   'icon'   — leading file icon + text
 *   'badge'  — a status pill
 *   'num'    — a short right-aligned number
 *   'date'   — a short mono date
 *   'actions'— a cluster of icon buttons (`count` of them)
 * A column may also be `{ type, className }` to carry responsive classes
 * (e.g. `hidden sm:table-cell`) so the skeleton hides what the table hides.
 * The table itself should set `aria-busy` while these rows are shown.
 */
export const TableRowsSkeleton = ({ columns, rows = 5, actionCount = 3 }) => (
  <>
    {Array.from({ length: rows }, (_, row) => (
      <tr key={row} className="border-t border-border" aria-hidden="true">
        {columns.map((column, index) => {
          const { type, className } = typeof column === 'string' ? { type: column } : column;
          return (
            <td key={index} className={cn('px-3 py-2.5', className)}>
              {type === 'title' && (
                <div className="space-y-1.5">
                  <Skeleton className={cn('h-3.5', widthAt(row))} />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              )}
              {type === 'icon' && (
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 shrink-0" />
                  <Skeleton className={cn('h-3.5', widthAt(row))} />
                </div>
              )}
              {type === 'text' && <Skeleton className={cn('h-3.5', widthAt(row + index))} />}
              {type === 'badge' && <Skeleton className="h-5 w-16 rounded" />}
              {type === 'num' && <Skeleton className="ml-auto h-3.5 w-6" />}
              {type === 'date' && <Skeleton className="h-3.5 w-20" />}
              {type === 'actions' && (
                <div className="flex justify-end gap-1.5">
                  {Array.from({ length: actionCount }, (_, i) => <Skeleton key={i} className="h-7 w-7" />)}
                </div>
              )}
            </td>
          );
        })}
      </tr>
    ))}
  </>
);

/** Rows of a simple list: icon, a line of text, a short trailing value. */
export const ListSkeleton = ({ rows = 5, className }) => (
  <div role="status" className={cn('overflow-hidden rounded-(--radius-lg) border border-border bg-surface', className)}>
    {Array.from({ length: rows }, (_, row) => (
      <div key={row} className="flex items-center gap-3 border-t border-border px-4 py-3.5 first:border-t-0">
        <Skeleton className="h-4 w-4 shrink-0" />
        <Skeleton className={cn('h-3.5', widthAt(row))} />
        <Skeleton className="ml-auto h-3 w-12 shrink-0" />
      </div>
    ))}
    <LoadingLabel />
  </div>
);

/** A conversation loading: a question on the right, an answer card on the left. */
export const ChatSkeleton = ({ turns = 2 }) => (
  <div role="status" className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-3 py-6 sm:px-6">
    {Array.from({ length: turns }, (_, turn) => (
      <div key={turn} className="flex flex-col gap-4">
        <div className="flex items-start justify-end gap-3">
          <Skeleton className={cn('h-10 rounded-[10px]', turn % 2 ? 'w-1/3' : 'w-1/2')} />
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-3 rounded-(--radius-lg) border border-border bg-surface p-4">
            <Skeleton className="h-3 w-40" />
            <div className="space-y-2 pt-1">
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-11/12" />
              <Skeleton className={cn('h-3.5', widthAt(turn + 2))} />
            </div>
          </div>
        </div>
      </div>
    ))}
    <LoadingLabel label="Loading conversation" />
  </div>
);

/**
 * A form loading: one card per entry in `sections`, each with that many
 * label + input pairs. A field count of `'list'` draws a picker instead.
 */
export const FormSkeleton = ({ sections = [3] }) => (
  <div role="status" className="space-y-4">
    {sections.map((fields, index) => (
      <div key={index} className="overflow-hidden rounded-(--radius-lg) border border-border bg-surface">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="space-y-4 p-4">
          {fields === 'list' ? (
            <>
              <Skeleton className="h-3 w-32" />
              <div className="space-y-2 rounded-(--radius-sm) border border-border p-3">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Skeleton className="h-4 w-4 shrink-0 rounded-[4px]" />
                    <Skeleton className={cn('h-3.5', widthAt(i))} />
                  </div>
                ))}
              </div>
            </>
          ) : (
            Array.from({ length: fields }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))
          )}
        </div>
      </div>
    ))}
    <LoadingLabel />
  </div>
);

/** A whole module loading (lazy route): its title bar and a content block. */
export const PageSkeleton = () => (
  <div role="status" className="flex min-h-0 flex-1 flex-col">
    <div className="border-b border-border bg-surface-2 px-4 py-4 sm:px-6">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-64 max-w-full" />
    </div>
    <div className="mx-auto w-full max-w-5xl space-y-3 px-4 py-5 sm:px-6">
      <Skeleton className="h-11 w-full max-w-sm" />
      <Skeleton className="h-64 w-full rounded-(--radius)" />
    </div>
    <LoadingLabel />
  </div>
);
