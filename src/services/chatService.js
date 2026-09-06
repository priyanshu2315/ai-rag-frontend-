import { getAPI } from './api';

const chatService = {
  /**
   * Fetch (or create, server-side) the active conversation for a context.
   *
   * The backend keys a conversation on the document being viewed, and treats
   * "no `documentId` at all" as the global All-documents conversation — so the
   * parameter is omitted entirely rather than sent as null, which would read
   * as a different context.
   */
  getConversation: (documentId, signal) =>
    getAPI('/chat/conversation', {
      params: documentId ? { documentId } : undefined,
      signal,
    }),
};

export default chatService;
