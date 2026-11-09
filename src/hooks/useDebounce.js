import { useEffect, useState } from 'react';

/** `value`, once it has stopped changing for `delay` ms (§6 debounced search). */
export const useDebounce = (value, delay = 300) => {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
};

export default useDebounce;
