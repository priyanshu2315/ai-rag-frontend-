import { metadataOf } from './messageMetadata.js';

/**
 * Web search with the user's approval ("human in the loop").
 *
 * A run that needs outside facts pauses with `approval_required`; the user
 * allows or skips it and `POST /chat/resume` continues the same run. These
 * helpers read that flow from live events and from saved metadata alike.
 */

const list = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const typeOf = (step) => step?.event?.type ?? step?.kind;

/** Only http(s) URLs become links: anything else (javascript:, data:) stays text. */
export const isWebUrl = (value) => typeof value === 'string' && /^https?:\/\/\S+$/i.test(value.trim());

/** `webHops` / `agent_start.tasks`, keeping only tasks that have text. */
export const webHopsOf = (value) => list(value)
  .filter((hop) => hop && typeof hop === 'object' && text(hop.task))
  .map((hop) => ({ id: hop.id ?? null, task: text(hop.task), dependsOn: list(hop.dependsOn) }));

export const APPROVAL = { AWAITING: 'awaiting', RESUMING: 'resuming' };

const approval = (status, { threadId, webHops, message }) => ({
  status,
  threadId: text(threadId) || null,
  webHops: webHopsOf(webHops),
  message: text(message) || null,
  // Set while a resume request is out: both buttons off, the chosen one spinning.
  pending: false,
  choice: null,
  error: null,
  // Also open it as a popup: set only when it arrives live on the open chat.
  popup: false,
});

/** The card a live `approval_required` event opens. */
export const approvalFromEvent = (event) => approval(APPROVAL.AWAITING, event ?? {});

/**
 * The card a saved message needs, from `metadata.status`: Allow / Skip while
 * it waits, "Answering…" while another tab (or a lost connection) resumes it.
 * `content` is the waiting text the backend saved as the message body.
 */
export const approvalFromMetadata = (metadata, content) => {
  const status = metadata?.status;
  if (status === 'awaiting_approval' && text(metadata.threadId)) {
    return approval(APPROVAL.AWAITING, { ...metadata, message: metadata.message ?? content });
  }
  if (status === 'resuming') return approval(APPROVAL.RESUMING, { ...metadata, message: metadata.message ?? content });
  return null;
};

/**
 * Agent tools by what they do. New runs use the Tavily MCP tools; saved older
 * messages and the fallback (MCP server down) use the built-in ones. An MCP
 * server can add tools at any time, so anything else is `other`.
 */
const TOOL_KINDS = {
  tavily_search: 'search',
  web_search: 'search',
  tavily_extract: 'read',
  read_page: 'read',
};

/** `tavily_extract` sends `args.urls` (an array), `read_page` a single `args.url`. */
const urlsOf = (args) => (Array.isArray(args?.urls) ? args.urls : [args?.url])
  .filter(isWebUrl)
  .map((url) => url.trim());

/** An unknown tool's args as compact JSON, or null when there are none. */
const argsJsonOf = (args) => {
  if (args == null) return null;
  if (typeof args === 'object' && Object.keys(args).length === 0) return null;
  return JSON.stringify(args) ?? null;
};

const callOf = (event) => {
  const tool = text(event.tool) || 'tool';
  const kind = TOOL_KINDS[tool] ?? 'other';
  return {
    step: Number.isFinite(event.step) ? event.step : null,
    tool,
    kind,
    // The MCP server the tool came from; null for built-in tools and older saved messages.
    mcpServer: text(event.mcpServer) || null,
    query: kind === 'search' ? text(event.args?.query) || null : null,
    urls: kind === 'read' ? urlsOf(event.args) : [],
    args: kind === 'other' ? argsJsonOf(event.args) : null,
    ok: event.ok !== false,
  };
};

const finishOf = (event) => ({
  failed: event.failed === true || (event.stopReason === 'failed' && !text(event.answer)),
  reason: text(event.reason) || null,
  answer: text(event.answer),
  stopReason: text(event.stopReason) || null,
  sources: list(event.sources).filter(isWebUrl),
});

/**
 * Everything web-related in one answer's steps, or null when there is none:
 * the web tasks, whether the user was asked and what they chose, and one
 * entry per research agent. One agent runs per web task, all at once, so
 * their events arrive interleaved and are grouped by `agentId` (older runs
 * had a single agent and no id).
 */
export const buildWebTrace = (steps = []) => {
  let asked = null;
  let result = null;
  let planned = [];
  const agents = new Map();
  const agentFor = (event) => {
    const id = text(event.agentId) || 'web';
    if (!agents.has(id)) agents.set(id, { id, hopId: text(event.hopId) || null, task: null, calls: [], finish: null, start: null });
    const agent = agents.get(id);
    agent.hopId ??= text(event.hopId) || null;
    agent.task ??= text(event.task) || null;
    return agent;
  };

  for (const step of list(steps)) {
    const event = step?.event;
    if (!event || typeof event !== 'object') continue;
    switch (typeOf(step)) {
      case 'approval_required': asked = event; break;
      case 'approval_result': result = event; break;
      case 'agent_start': agentFor(event).start = event; break;
      case 'agent_step': agentFor(event).calls.push(callOf(event)); break;
      case 'agent_finish': agentFor(event).finish = finishOf(event); break;
      case 'tool_finish':
        if ((event.tool ?? step.label) === 'Question Splitter' && list(event.webHops).length) planned = webHopsOf(event.webHops);
        break;
      default: break;
    }
  }

  const legacyTasks = [...agents.values()].flatMap((agent) => webHopsOf(agent.start?.tasks));
  const hops = planned.length ? planned : webHopsOf(asked?.webHops).length ? webHopsOf(asked.webHops) : legacyTasks;
  if (!asked && !result && agents.size === 0 && !hops.length) return null;

  return {
    hops,
    asked: asked ? { hops: webHopsOf(asked.webHops), message: text(asked.message) || null } : null,
    approved: typeof result?.approved === 'boolean' ? result.approved : null,
    agents: [...agents.values()].map(({ start: _start, ...agent }) => ({
      ...agent,
      // The task: from the agent itself, else its hop in the plan, else the old single-agent list.
      task: agent.task ?? hops.find((hop) => hop.id && hop.id === agent.hopId)?.task ?? (agents.size === 1 ? legacyTasks[0]?.task ?? null : null),
      running: !agent.finish,
    })),
  };
};

/**
 * "Searching: <query>" / "Reading: <url> +N more" — one agent call, as the
 * live status says it. The same for built-in and MCP tools.
 */
export const webCallLabel = (call) => {
  if (call.kind === 'search') return `Searching: ${call.query ?? 'the web'}`;
  if (call.kind === 'read') {
    const [first, ...rest] = call.urls;
    if (!first) return 'Reading: a page';
    return `Reading: ${first}${rest.length ? ` +${rest.length} more` : ''}`;
  }
  return `${call.tool}…`;
};

/** What one agent is doing right now, or did last. */
export const agentLabel = (agent) => {
  const last = agent.calls.at(-1);
  return last ? webCallLabel(last) : 'Starting…';
};

/** The live status while the web is being searched, or null when it is not. */
export const liveWebLabel = (web) => {
  if (!web || web.approved !== true) return null;
  if (web.agents.length === 0) return 'Searching the web…';
  const running = web.agents.filter((agent) => agent.running);
  if (running.length === 0) return null;
  if (running.length > 1) return `Searching the web · ${running.length} agents`;
  return running[0].calls.length ? webCallLabel(running[0].calls.at(-1)) : 'Searching the web…';
};

/**
 * What the web search gave the answer, or null when the web was not searched:
 * every page looked at (once), when, and the tasks whose search failed.
 * Saved `metadata.webFacts` first (`results[]`, one per agent, or the older
 * single `answer`); live, before a reload, the agents' own `agent_finish`.
 */
export const messageWebFacts = (message, steps = []) => {
  const saved = metadataOf(message).webFacts;
  let results;
  let searchedAt = null;
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    const parsed = Date.parse(saved.searchedAt);
    searchedAt = Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
    results = (Array.isArray(saved.results) ? saved.results : [saved])
      .filter((item) => item && typeof item === 'object')
      .map((item) => ({ task: text(item.task) || null, ...finishOf(item) }));
  } else {
    results = (buildWebTrace(steps)?.agents ?? []).filter((agent) => agent.finish).map((agent) => ({ task: agent.task, ...agent.finish }));
  }
  if (!results.length) return null;
  return {
    sources: [...new Set(results.flatMap((item) => item.sources))],
    searchedAt,
    failures: results.filter((item) => item.failed).map((item) => item.task),
  };
};

/** true allowed, false skipped, null never asked. */
export const messageWebApproval = (message, steps = []) => {
  const saved = metadataOf(message).webApproval;
  if (typeof saved === 'boolean') return saved;
  if (typeof message?.webApproval === 'boolean') return message.webApproval;
  return buildWebTrace(steps)?.approved ?? null;
};
