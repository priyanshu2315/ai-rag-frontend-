import cn from '../../utils/cn';

/**
 * Loading placeholder (§12) — a shimmering block sized by the caller.
 * `as="span"` for use inside text (a title or subtitle still loading).
 * Hidden from screen readers; the group around it announces "Loading".
 */
const Skeleton = ({ as: Tag = 'div', className }) => (
  <Tag aria-hidden="true" className={cn('shimmer block rounded-(--radius-sm)', className)} />
);

export default Skeleton;
