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
  SUMMARIZING: 'summarizing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  POLLING: 'polling',
  ERROR: 'error',
};

/**
 * `reconnected` is true whenever the stream did not start with the upload: the
 * backend does not replay, so the tree is then only what arrives from now on.
 */
export const createInitialProgress = (reconnected = false) => ({
  phase: PHASE.CONNECTING,
  reconnected,
  totalPages: null,
  currentPage: null,
  pages: [],
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

const applyEvent = (state, event) => {
  switch (event.type) {
    case 'page_start':
      return {
        ...state,
        phase: PHASE.STREAMING,
        totalPages: event.totalPages ?? state.totalPages,
        currentPage: event.page,
        pages: upsert(state.pages, event.page, makePage, (page) => page),
      };

    case 'parent':
      return {
        ...state,
        phase: PHASE.STREAMING,
        currentPage: event.page,
        pages: upsert(state.pages, event.page, makePage, (page) => ({
          ...page,
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
        phase: PHASE.STREAMING,
        currentPage: event.page,
        pages: upsert(state.pages, event.page, makePage, (page) => ({
          ...page,
          parents: upsert(page.parents, event.parent, makeParent, (parent) => ({
            ...parent,
            child: event.child,
            totalChildren: event.totalChildren ?? parent.totalChildren,
          })),
        })),
      };

    case 'summarizing':
      return { ...state, phase: PHASE.SUMMARIZING };

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

    // Reopening the stream mid-way is exactly the "no replay" case.
    case 'reconnecting':
      return { ...state, phase: PHASE.RECONNECTING, reconnected: true };

    case 'polling':
      return { ...state, phase: PHASE.POLLING, reconnected: true };

    case 'error':
      return { ...state, phase: PHASE.ERROR, message: action.message };

    case 'event':
      return { ...applyEvent(state, action.event), events: state.events + 1 };

    default:
      return state;
  }
};
