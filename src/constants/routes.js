/** Every route string lives here — never hard-code a path in a component (§14). */
export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  CHAT: '/',
  DOCUMENT: '/documents/:documentId',
  CHUNKS: '/documents/:documentId/chunks',
  ABOUT: '/about',
};

/**
 * The path for a document context — or for "all documents" when `id` is null.
 *
 * The selected document lives in the URL rather than in the store, so a
 * refresh, a bookmark and a shared link all reopen the same conversation
 * instead of dropping the user back on the global view.
 */
export const documentPath = (id) => (id ? `/documents/${id}` : ROUTES.CHAT);

/** The chunk explorer for one document — only ever reachable with an id. */
export const chunksPath = (id) => `/documents/${id}/chunks`;
