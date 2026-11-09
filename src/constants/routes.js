/** Every route string lives here — never hard-code a path in a component (§14). */
export const ROUTES = {
  LOGIN: '/login',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  /** Forced first-login password change — reachable only while the flag is set. */
  SET_PASSWORD: '/set-password',

  /** An empty "new chat" screen — no chat exists until the first question. */
  CHAT: '/',
  /** One global chat: answers from every document the user can access. */
  CHAT_CONVERSATION: '/chat/:chatId',
  CHATS: '/chats',
  KNOWLEDGE_BASE: '/knowledge-base',
  DOCUMENT: '/documents/:documentId',
  CHUNKS: '/documents/:documentId/chunks',

  UPLOAD: '/upload',
  ROLES: '/roles',
  ROLE_NEW: '/roles/new',
  ROLE_EDIT: '/roles/:roleId',
  USERS: '/users',
  USER_NEW: '/users/new',
  USER_EDIT: '/users/:userId',

  ABOUT: '/about',
  ARCHITECTURE: '/architecture',
};

/** One global chat. */
export const chatPath = (id) => `/chat/${id}`;

export const rolePath = (id) => `/roles/${id}`;
export const userPath = (id) => `/users/${id}`;

/**
 * The path for a document's chat — or the new-chat screen when `id` is null.
 *
 * The selected document lives in the URL rather than in the store, so a
 * refresh, a bookmark and a shared link all reopen the same conversation.
 */
export const documentPath = (id) => (id ? `/documents/${id}` : ROUTES.CHAT);

/** The chunk explorer for one document — only ever reachable with an id. */
export const chunksPath = (id) => `/documents/${id}/chunks`;
