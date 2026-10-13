import { messageCitations, messageReasoningChain, messageSteps, messageStepCosts, messageUsage } from './messageMetadata.js';
import { observedChunks } from './crossReferences.js';
import { readableTraceText, traceChunkLabels } from './traceChunks.js';

/** Export the full message data, including steps hidden by collapsed/scrolling UI. */
export const reasoningExport = (message) => {
  const steps = messageSteps(message);
  const chain = messageReasoningChain(message);
  const labels = traceChunkLabels(steps);
  const sections = ['# Answer', message?.content || '(No answer text received yet.)'];
  if (chain) {
    sections.push('# Reasoning Chain');
    if (chain.summary) sections.push(`## Summary\n${readableTraceText(chain.summary, labels)}`);
    for (const [index, step] of chain.steps.entries()) {
      sections.push(`## Step ${step.step ?? index + 1}: ${readableTraceText(step.title, labels)}\nType: ${step.type}`);
      if (step.description) sections.push(readableTraceText(step.description, labels));
      if (step.findings) sections.push(`Findings:\n${readableTraceText(step.findings, labels)}`);
    }
  }
  if (steps.length) {
    sections.push('# Detailed Execution Trace');
    for (const [index, step] of steps.entries()) {
      sections.push(`## Event ${index + 1}: ${step.kind}\n${readableTraceText(step.label ?? '', labels)}${step.query ? `\nQuery: ${step.query}` : ''}${step.detail ? `\n${readableTraceText(step.detail, labels)}` : ''}`);
      sections.push(JSON.stringify(step.event ?? step, null, 2));
    }
  }
  const citations = messageCitations(message);
  const chunks = observedChunks(steps, message?.retrievedChunks);
  const costs = messageStepCosts(message);
  const usage = messageUsage(message);
  if (citations.length) sections.push('# Sources / Citations', JSON.stringify(citations, null, 2));
  if (chunks.length) sections.push('# Retrieved Evidence', JSON.stringify(chunks, null, 2));
  if (usage || costs.length) sections.push('# Token Usage and Costs', JSON.stringify({ summary: usage, steps: costs }, null, 2));
  if (message?.streaming) sections.push('Note: Copied during streaming. This includes everything received so far.');
  return sections.join('\n\n');
};
