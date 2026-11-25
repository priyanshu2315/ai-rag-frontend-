import createAppThunk from '../createAppThunk';
import chatService from '../../services/chatService';

/** The user's global chats, most recently used first. */
export const fetchChats = createAppThunk('chats/fetch', (_arg, { signal }) =>
  chatService.getChats(signal)
);

/** Admin only: every user's global chats (`?scope=all`), each with its owner. */
export const fetchAllChats = createAppThunk('chats/fetchAll', (_arg, { signal }) =>
  chatService.getAllChats(signal)
);

/** `{ title? }` — the backend titles it from the first question otherwise. */
export const createChat = createAppThunk('chats/create', (payload, { signal }) =>
  chatService.createChat(payload, signal)
);

export const renameChat = createAppThunk('chats/rename', ({ id, title }, { signal }) =>
  chatService.renameChat(id, title, signal)
);

export const deleteChat = createAppThunk('chats/delete', (id, { signal }) =>
  chatService.deleteChat(id, signal)
);
