import { createSelector, createSlice } from '@reduxjs/toolkit';
import { createChat, deleteChat, fetchChats, renameChat } from '../actions/chatsActions';
import { fetchConversation } from '../actions/chatActions';
import { isCanceled } from '../createAppThunk';

/**
 * The list of global chats (§7.1 standard shape). The open chat's transcript
 * lives in the `chat` slice; this is only the index of chats.
 */
const initialState = {
  list: [],
  loaded: false,
  loading: false,
  error: null,
  creating: false,
  savingId: null,
  deletingId: null,
};

const byRecent = (a, b) => new Date(b.updatedAt ?? 0) - new Date(a.updatedAt ?? 0);

const chatsSlice = createSlice({
  name: 'chats',
  initialState,
  reducers: {
    /** Shows a chat's title at once (the first question), before the server confirms it. */
    chatTitled: (state, action) => {
      const chat = state.list.find((item) => item.id === action.payload.id);
      if (chat) chat.title = action.payload.title;
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

      .addCase(createChat.pending, (state) => {
        state.creating = true;
      })
      .addCase(createChat.fulfilled, (state, action) => {
        state.creating = false;
        if (action.payload?.id) state.list.unshift(action.payload);
      })
      .addCase(createChat.rejected, (state) => {
        state.creating = false;
      })

      .addCase(renameChat.pending, (state, action) => {
        state.savingId = action.meta.arg.id;
      })
      .addCase(renameChat.fulfilled, (state, action) => {
        state.savingId = null;
        const chat = state.list.find((item) => item.id === action.meta.arg.id);
        if (chat) chat.title = action.payload?.title ?? action.meta.arg.title;
      })
      .addCase(renameChat.rejected, (state) => {
        state.savingId = null;
      })

      .addCase(deleteChat.pending, (state, action) => {
        state.deletingId = action.meta.arg;
      })
      .addCase(deleteChat.fulfilled, (state, action) => {
        state.deletingId = null;
        state.list = state.list.filter((chat) => chat.id !== action.meta.arg);
      })
      .addCase(deleteChat.rejected, (state) => {
        state.deletingId = null;
      })

      // Opening a chat that no longer exists drops it from the list too.
      .addCase(fetchConversation.rejected, (state, action) => {
        const chatId = action.meta.arg?.chatId;
        if (chatId && action.payload?.status === 404) {
          state.list = state.list.filter((chat) => chat.id !== chatId);
        }
      });
  },
});

export const { chatTitled } = chatsSlice.actions;

/** The list as shown: most recently used first, whatever order it arrived in. */
export const selectChats = createSelector([(state) => state.chats.list], (list) => [...list].sort(byRecent));

export default chatsSlice.reducer;
