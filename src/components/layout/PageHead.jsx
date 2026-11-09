import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import cn from '../../utils/cn';

/**
 * A module's own title bar, inside the content area (§4). Module actions —
 * preview, chunks, clear chat, delete — live here, not in the global header.
 *
 * `crumbs` is an optional trail of `{ label, to }` shown above the title, e.g.
 * Knowledge base › report.pdf.
 */
const PageHead = ({ title, subtitle, crumbs, actions, className }) => (
  <div
    className={cn(
      'flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface-2 px-4 py-3 sm:px-6',
      className
    )}
  >
    <div className="min-w-0 flex-1">
      {crumbs?.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-0.5 flex min-w-0 items-center gap-1 text-[12px] text-muted">
          {crumbs.map((crumb) => (
            <span key={crumb.to} className="flex min-w-0 items-center gap-1">
              <Link to={crumb.to} className="truncate hover:text-blue">{crumb.label}</Link>
              <ChevronRight className="h-3 w-3 shrink-0" />
            </span>
          ))}
        </nav>
      )}
      <h1 className="truncate text-[16px] font-semibold text-ink" title={typeof title === 'string' ? title : undefined}>
        {title}
      </h1>
      {subtitle && <p className="truncate text-[12.5px] text-muted">{subtitle}</p>}
    </div>

    {actions && (
      <div className="flex max-w-full items-center gap-1 overflow-x-auto">{actions}</div>
    )}
  </div>
);

export default PageHead;
