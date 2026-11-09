import cn from '../../utils/cn';

/**
 * The "still working" mark: a page with a beam sweeping down it, which is
 * what the agent is doing while the trace fills in. Icon-sized so it sits
 * inline beside a heading and never covers the trace itself. Labelled with
 * aria-label, not an `sr-only` child — that child is absolutely positioned and
 * would escape the chat's scroll area (see `StatusDot`).
 */
const SearchingMark = ({ label = 'Answer in progress', className }) => (
  <svg viewBox="0 0 16 16" role="img" aria-label={label} className={cn('h-4 w-4 shrink-0 text-blue', className)}>
    <title>{label}</title>
    <rect x="3" y="1.5" width="10" height="13" rx="1.6" fill="var(--color-blue-lt)" stroke="currentColor" strokeWidth="1.1" />
    <g stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.45">
      <path d="M5.5 5h5" />
      <path d="M5.5 7.5h5" />
      <path d="M5.5 10h3.5" />
    </g>
    <g className="trace-scan">
      <rect x="2" y="1.6" width="12" height="3.2" rx="1" fill="currentColor" opacity="0.18" />
      <rect x="2" y="3.4" width="12" height="1.4" rx="0.7" fill="currentColor" />
    </g>
  </svg>
);

export default SearchingMark;
