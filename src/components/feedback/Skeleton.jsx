import cn from '../../utils/cn';

/** Loading placeholder (§12) — sized by the caller. */
const Skeleton = ({ className }) => (
  <div className={cn('animate-pulse rounded-(--radius-sm) bg-border', className)} />
);

export default Skeleton;
