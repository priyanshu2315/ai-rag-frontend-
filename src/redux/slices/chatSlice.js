import { createSlice } from '@reduxjs/toolkit';
import { askQuestion } from '../actions/chatActions';
import { isCanceled } from '../createAppThunk';
import { MESSAGES, ROLE } from '../../constants/messages';

/**
 * Not persisted — a refresh starts a fresh conversation, which is what the
 * backend assumes (it holds no session transcript).
 *
 * `seq` keeps message ids unique without calling into anything impure from a
 * reducer. `lastAsk` is kept so a "still processing" answer can be retried
 * with the same question and document.
 */
const initialState = {
  messages: [],
  sending: false,
  error: null,
  seq: 0,
  lastAsk: null,
};

const pushMessage = (state, role, content, extra = {}) => {
  state.seq += 1;
  state.messages.push({ id: `m${state.seq}`, role, content, ...extra });
};

/** The bubble currently being streamed into, if there is one. */
const streamingMessage = (state) => {
  const last = state.messages[state.messages.length - 1];
  return last?.role === ROLE.ASSISTANT && last.streaming ? last : null;
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    /** Optimistic — the question renders before the request resolves. */
    askedQuestion: {
      reducer: (state, action) => {
        pushMessage(state, ROLE.USER, action.payload.content, {
          createdAt: action.payload.createdAt,
        });
      },
      prepare: (content) => ({ payload: { content, createdAt: new Date().toISOString() } }),
    },

    /** The empty bubble the answer streams into; renders as "thinking". */
    answerStarted: {
      reducer: (state, action) => {
        pushMessage(state, ROLE.ASSISTANT, '', {
          createdAt: action.payload.createdAt,
          streaming: true,
        });
      },
      prepare: () => ({ payload: { createdAt: new Date().toISOString() } }),
    },

    /**
     * Appends one fragment. Fragments are raw — never whole words — so they
     * are concatenated exactly as received.
     */
    answerToken: (state, action) => {
      const message = streamingMessage(state);
      if (message) message.content += action.payload;
    },

    /** Drops a failed answer so a retry does not stack bubbles. */
    droppedLastAnswer: (state) => {
      const last = state.messages[state.messages.length - 1];
      if (last?.role === ROLE.ASSISTANT) state.messages.pop();
    },

    clearChat: () => initialState,
  },

  extraReducers: (builder) => {
    builder
      .addCase(askQuestion.pending, (state, action) => {
        state.sending = true;
        state.error = null;
        state.lastAsk = action.meta.arg;
      })

      .addCase(askQuestion.fulfilled, (state) => {
        state.sending = false;

        const message = streamingMessage(state);
        if (!message) return;
        message.streaming = false;

        // A stream can legitimately finish having sent no tokens at all, when
        // nothing in the documents matched. That is an answer, not a failure.
        if (!message.content) {
          message.content = MESSAGES.NO_ANSWER;
          message.muted = true;
        }
      })

      .addCase(askQuestion.rejected, (state, action) => {
        state.sending = false;

        const message = streamingMessage(state);
        if (message) message.streaming = false;

        if (isCanceled(action)) {
          // Whatever text already arrived is kept — the user stopped it, they
          // did not ask to throw it away. An untouched bubble is just noise.
          if (message && !message.content) state.messages.pop();
          else if (message) message.stopped = true;
          return;
        }

        const { message: text, retryable } = action.payload ?? {};
        state.error = text ?? null;

        if (!message) return;
        message.retryable = Boolean(retryable);

        if (message.content) {
          // Partial answer: keep it, and note that it was cut short.
          message.interrupted = true;
          message.notice = text ?? MESSAGES.CHAT_ERROR;
        } else {
          message.failed = true;
          message.content = text ?? MESSAGES.CHAT_ERROR;
        }
      });
  },
});

export const { askedQuestion, answerStarted, answerToken, droppedLastAnswer, clearChat } =
  chatSlice.actions;

export default chatSlice.reducer;
