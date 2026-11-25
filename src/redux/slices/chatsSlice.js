import { createSelector, createSlice } from '@reduxjs/toolkit';
import { createChat, deleteChat, fetchAllChats, fetchChats, renameChat } from '../actions/chatsActions';
import { fetchConversation } from '../actions/chatActions';
import { isCanceled } from '../createAppThunk';
import { CHAT_SCOPE } from '../../constants/chatScope';

/**
 * The list of global chats (§7.1 standard shape). The open chat's transcript
 * lives in the `chat` slice; this is only the index of chats.
 *
 * `list` is always the user's own chats — titles, "Recent chats" and the
 * first-question rename all read it. An admin's "All" view is a second list,
 * `all`, fetched only while it is shown; the admin's own chats appear in both.
 */
const initialState = {
  list: [],
  loaded: false,
  loading: false,
  error: null,
  creating: false,
  savingId: null,
  deletingId: null,
  /** The scope the Chats page last showed — what "back to Chats" and the after-answer refresh use. */
  scope: CHAT_SCOPE.MINE,
  all: { list: [], loaded: false, loading: false, error: null },
  /** The backend refused `scope=all` (the account was demoted): the toggle goes for this session. */
  allDenied: false,
};

/** Both lists hold the admin's own chats, so a change to one is made to each. */
const eachCopy = (state, id, change) => {
  [state.list, state.all.list].forEach((list) => {
    const chat = list.find((item) => item.id === id);
    if (chat) change(chat);
  });
};

const dropChat = (state, id) => {
  state.list = state.list.filter((chat) => chat.id !== id);
  state.all.list = state.all.list.filter((chat) => chat.id !== id);
};

const byRecent = (a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0);

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    /** Shows a chat's title at once (the first question), before the server confirms it. */
    chatTitled: (state, action) => {
      eachCopy(state, action.payload.id, (chat) => { chat.title = action.payload.title; });
    },
    scopeChosen: (state, action) => {
      state.scope = action.payload === CHAT_SCOPE.ALL ? CHAT_SCOPE.ALL : CHAT_SCOPE.MINE;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChats.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchChats.fulfilled, (state, action) => {
        state.loading = false;
        state.loaded = true;
        state.list = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchChats.rejected, (state, action) => {
        if (isCanceled(action)) return;
        state.loading = false;
        state.error = action.payload?.message ?? null;
      })

      .addCase(fetchAllChats.pending, (state) => {
        state.all.loading = true;
        state.all.error = null;
      })
      .addCase(fetchAllChats.fulfilled, (state, action) => {
        state.all.loading = false;
        state.all.loaded = true;
        state.all.list = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(fetchAllChats.rejected, (state, action) => {
        if (isCanceled(action)) return;
        state.all.loading = false;
        if (action.payload?.status === 403) {
          state.all = initialState.all;
          state.allDenied = true;
          state.scope = CHAT_SCOPE.MINE;
          return;
        }
        state.all.error = action.payload?.message ?? null;
      })

      .addCase(createChat.pending, (state) => {
        state.creating = true;
      })
      .addCase(createChat.fulfilled, (state, action) => {
        state.creating = false;
        if (action.payload?.id) state.list.unshift(action.payload);
        // A new chat is always the user's own, so the list it belongs to is "My".
        state.scope = CHAT_SCOPE.MINE;
      })
      .addCase(createChat.rejected, (state) => {
        state.creating = false;
      })

      .addCase(renameChat.pending, (state, action) => {
        state.savingId = action.meta.arg.id;
      })
      .addCase(renameChat.fulfilled, (state, action) => {
        state.savingId = null;
        eachCopy(state, action.meta.arg.id, (chat) => { chat.title = action.payload?.title ?? action.meta.arg.title; });
      })
      .addCase(renameChat.rejected, (state) => {
        state.savingId = null;
      })

      .addCase(deleteChat.pending, (state, action) => {
        state.deletingId = action.meta.arg;
      })
      .addCase(deleteChat.fulfilled, (state, action) => {
        state.deletingId = null;
        dropChat(state, action.meta.arg);
      })
      .addCase(deleteChat.rejected, (state) => {
        state.deletingId = null;
      })

      // Opening a chat that no longer exists drops it from the list too.
      .addCase(fetchConversation.rejected, (state, action) => {
        const chatId = action.meta.arg?.chatId;
        if (chatId && action.payload?.status === 404) {
          dropChat(state, chatId);
        }
      });
  },
});

export const { chatTitled, scopeChosen } = chatsSlice.actions;

/** The list as shown: most recently used first, whatever order it arrived in. */
export const selectChats = createSelector([(state) => state.chats.list], (list) => [...list].sort(byRecent));

/** Every user's chats (admin "All"), most recently used first. */
export const selectAllChats = createSelector([(state) => state.chats.all.list], (list) => [...list].sort(byRecent));

export default chatsSlice.reducer;
