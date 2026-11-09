import { useRef } from 'react';

/**
 * Every token bumps the message's last step, so `steps` is a new array per
 * fragment. The search events themselves keep their identity under immer —
 * holding on to the same list until one of them changes lets anything
 * memoised on it skip the re-render mid-stream.
 */
export const useTraceSteps = (steps) => {
  const ref = useRef([]);
  const next = steps.filter((step) => step.kind !== 'token');
  if (next.length !== ref.current.length || next.some((step, index) => step !== ref.current[index])) ref.current = next;
  return ref.current;
};

export default useTraceSteps;
