import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Conditional classes + Tailwind conflict resolution in one call, so a
 * caller's `className` always wins over a component's own defaults.
 */
export const cn = (...inputs) => twMerge(clsx(inputs));

export default cn;
