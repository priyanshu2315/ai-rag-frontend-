import { emptyStructure, applyStructureEvent } from './structuredInspector.js';
/**
 * State for the live processing tree, built up one SSE event at a time.
 *
 *   pages: [{ number, parents: [{ number, id, preview, child, totalChildren }] }]
 *
 * Page numbers can have gaps (empty pages are skipped), and a client that
 * connects mid-way never saw the `page_start` / `parent` events that came
 * before — so `parent` and `child` create whatever they refer to when it is
 * missing instead of assuming the ancestors exist.
 */

export const PHASE = {
  CONNECTING: 'connecting',
  RECONNECTING: 'reconnecting',
  STREAMING: 'streaming',
  SAVING: 'saving',
  SUMMARIZING: 'summarizing',
  CHUNKS_READY: 'chunks_ready',
  SUMMARY_FAILED: 'summary_failed',
  COMPLETED: 'completed',
  FAILED: 'failed',
  POLLING: 'polling',
  ERROR: 'error',
};

/**
 * `reconnected` is true whenever the stream did not start with the upload.
 * The server sends its current state after reconnecting.
 */
export const createInitialProgress = (reconnected = false) => ({
  phase: PHASE.CONNECTING,
  connection: 'connecting',
  connectionAttempts: 0,
  structure: emptyStructure(),
  reconnected,
  totalPages: null,
  currentPage: null,
  pages: [],
  timeline: [],
  seenEventIds: {},
  events: 0,
  message: null,
});

/** Updates the item numbered `number`, creating it (via `make`) when absent. */
const upsert = (list, number, make, update) => {
  const index = list.findIndex((item) => item.number === number);
  if (index === -1) return [...list, update(make(number))];
  return list.map((item, i) => (i === index ? update(item) : item));
};

const makePage = (number) => ({ number, parents: [] });
const makeParent = (number) => ({
  number,
  id: null,
  preview: '',
  child: 0,
  totalChildren: null,
});

const preparationPhase = (phase) =>
  [PHASE.CONNECTING, PHASE.RECONNECTING, PHASE.STREAMING].includes(phase)
    ? PHASE.STREAMING : phase;

const phaseRank = {
  [PHASE.CONNECTING]: 0, [PHASE.RECONNECTING]: 0, [PHASE.POLLING]: 0,
  [PHASE.ERROR]: 0, [PHASE.STREAMING]: 1, [PHASE.SAVING]: 2,
  [PHASE.CHUNKS_READY]: 3, [PHASE.SUMMARIZING]: 4,
  [PHASE.SUMMARY_FAILED]: 5, [PHASE.COMPLETED]: 5, [PHASE.FAILED]: 5,
};
const advancePhase = (current, next) => phaseRank[current] >= phaseRank[next] ? current : next;

const applyEvent = (state, event) => {
  if (/^(gemini_extraction|markdown_correction)_/.test(event.type) ||
    ['ocr_complete', 'extraction_complete'].includes(event.type)) {
    state = { ...state, phase: preparationPhase(state.phase),
      totalPages: event.totalPages ?? state.totalPages };
  }
  switch (event.type) {
    case 'state': {
      const status = event.status ?? event.data?.status;
      const summaryStatus = event.summaryStatus ?? event.data?.summaryStatus;
      if (status === 'FAILED') return { ...state, phase: PHASE.FAILED };
      if (summaryStatus === 'FAILED') return { ...state, phase: PHASE.SUMMARY_FAILED };
      if (summaryStatus === 'COMPLETED') return { ...state, phase: PHASE.COMPLETED };
      if (summaryStatus === 'PROCESSING') return { ...state, phase: PHASE.SUMMARIZING };
      if (status === 'COMPLETED') return { ...state, phase: PHASE.CHUNKS_READY };
      return state;
    }
    case 'page_start':
    case 'page_extracted':
    case 'page_transcribed':
    case 'page_corrected':
      return {
        ...state,
        phase: preparationPhase(state.phase),
        totalPages: event.totalPages ?? state.totalPages,
        currentPage: event.page == null ? state.currentPage : Math.max(state.currentPage ?? 0, event.page),
        pages: upsert(state.pages, event.source?.id ?? event.sourceId ?? event.page, makePage, (page) => ({ ...page,
          source: event.source ?? page.source ?? (event.sourceId ? { id: event.sourceId } : null), physicalPage: event.page })),
      };

    case 'parent':
      return {
        ...state,
        phase: preparationPhase(state.phase),
        currentPage: event.page == null ? state.currentPage : Math.max(state.currentPage ?? 0, event.page),
        pages: upsert(state.pages, event.source?.id ?? event.page, makePage, (page) => ({
          ...page,
          source: event.source, physicalPage: event.page,
          parents: upsert(page.parents, event.parent, makeParent, (parent) => ({
            ...parent,
            id: event.parentId ?? parent.id,
            preview: event.preview ?? parent.preview,
          })),
        })),
      };

    case 'child':
      return {
        ...state,
        phase: preparationPhase(state.phase),
        currentPage: event.page == null ? state.currentPage : Math.max(state.currentPage ?? 0, event.page),
        pages: upsert(state.pages, event.source?.id ?? event.page, makePage, (page) => ({
          ...page,
          source: event.source, physicalPage: event.page,
          parents: upsert(page.parents, event.parent, makeParent, (parent) => ({
            ...parent,
            child: Math.max(parent.child, event.child ?? 0),
            totalChildren: event.totalChildren == null
              ? parent.totalChildren
              : Math.max(parent.totalChildren ?? 0, event.totalChildren),
          })),
        })),
      };

    case 'summarizing':
      return { ...state, phase: advancePhase(state.phase, PHASE.SUMMARIZING) };

    case 'saving_chunks':
    case 'chunks_saved':
      return { ...state, phase: advancePhase(state.phase, PHASE.SAVING) };

    case 'chunks_ready':
      return { ...state, phase: advancePhase(state.phase, PHASE.CHUNKS_READY) };

    case 'summary_failed':
      return { ...state, phase: PHASE.SUMMARY_FAILED, message: event.message ?? null };

    case 'completed':
      return { ...state, phase: PHASE.COMPLETED };

    case 'failed':
      return { ...state, phase: PHASE.FAILED, message: event.message ?? null };

    // An event type this client does not know is ignored, not an error.
    default:
      return state;
  }
};

export const progressReducer = (state, action) => {
  switch (action.type) {
    case 'reset':
      return createInitialProgress(action.reconnected);

    case 'connected':
      return { ...state, connection: 'connecting', reconnected: state.reconnected || action.reconnected };

    // Reopening the stream mid-way is exactly the "no replay" case.
    case 'reconnecting':
      return {
        ...state,
        connection: 'reconnecting',
        connectionAttempts: state.connectionAttempts + 1,
        phase: state.phase,
        reconnected: true,
      };

    case 'polling':
      return { ...state, phase: PHASE.POLLING, reconnected: true };

    case 'error':
      return { ...state, connection: 'disconnected', message: action.message };

    case 'event': {
      if (action.event.eventId && state.seenEventIds[action.event.eventId]) return state;
      const next = applyEvent(state, action.event);
      return {
        ...next,
        connection: ['completed', 'summary_failed', 'failed'].includes(action.event.type) ? 'closed' : 'connected',
        structure: applyStructureEvent(state.structure ?? emptyStructure(), action.event),
        events: state.events + 1,
        seenEventIds: action.event.eventId
          ? { ...state.seenEventIds, [action.event.eventId]: true }
          : state.seenEventIds,
        timeline: action.event.type === 'state'
          ? state.timeline : [...state.timeline, action.event],
      };
    }

    default:
      return state;
  }
};
