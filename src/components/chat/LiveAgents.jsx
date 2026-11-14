import { useMemo } from 'react';
import { RunningAgents } from './WebSearch';
import { buildWebTrace } from '../../utils/webSearch';
import useTraceSteps from '../../hooks/useTraceSteps';

const NO_STEPS = [];

/**
 * The web research agents of the answer streaming right now, for the line
 * under the chat input. Nothing once the stream is done, and nothing for a
 * reloaded answer: its agents live in the steps panel.
 */
const LiveAgents = ({ messages }) => {
  const streaming = messages.findLast((message) => message.streaming);
  // Tokens grow the steps on every fragment; only agent events matter here.
  const steps = useTraceSteps(streaming?.steps ?? NO_STEPS);
  const agents = useMemo(() => buildWebTrace(steps)?.agents ?? [], [steps]);
  if (!streaming || agents.length === 0) return null;
  // Keyed by message, so a new answer starts with the list closed.
  return <RunningAgents key={streaming.id} agents={agents} />;
};

export default LiveAgents;
