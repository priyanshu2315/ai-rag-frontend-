import { deleteAPI, getAPI, patchAPI, postAPI } from './api';

const chatService = {
  /**
   * A document's chat — one per user per document, created server-side on
   * first fetch. `documentId` is required by the backend now; global chats
   * have their own endpoints below.
   *
   * A 404 here means the document left this account's roles, which the
   * documents slice handles — hence `quietNotFound`.
   */
  getConversation: (documentId, signal) =>
    getAPI('/chat/conversation', {
      params: documentId ? { documentId } : undefined,
      signal,
      quietNotFound: true,
    }),

  /** Clears that document chat's messages. */
  deleteConversation: (documentId, signal) =>
    deleteAPI('/chat/conversation', {
      params: documentId ? { documentId } : undefined,
      signal,
      quietNotFound: true,
    }),

  /* ── Global chats (many per user, each with its own history) ──────────── */

  /** `[{ id, title, createdAt, updatedAt }]`, most recently used first — the user's own. */
  getChats: (signal) => getAPI('/chat/conversations', { signal }),

  /**
   * Admin only: every user's global chats, newest first —
   * `[{ id, title, createdAt, updatedAt, owner: { id, name, email }, messageCount, isMine }]`.
   * A 403 (the account was demoted) is the caller's to explain, so it is not
   * toasted here as a generic "no permission".
   */
  getAllChats: (signal) =>
    getAPI('/chat/conversations', { params: { scope: 'all' }, signal, silentStatuses: [403] }),

  createChat: (payload = {}, signal) => postAPI('/chat/conversations', payload, { signal }),

  /**
   * One global chat with its messages — same shape as a document conversation,
   * plus `isMine`, and for an admin the owner as `user: { id, name, email }`
   * (admins can open anyone's chat, read-only).
   */
  getChat: (chatId, signal) =>
    getAPI(`/chat/conversations/${encodeURIComponent(chatId)}`, { signal, quietNotFound: true }),

  renameChat: (chatId, title, signal) =>
    patchAPI(`/chat/conversations/${encodeURIComponent(chatId)}`, { title }, { signal }),

  deleteChat: (chatId, signal) =>
    deleteAPI(`/chat/conversations/${encodeURIComponent(chatId)}`, { signal }),
};

export default chatService;
