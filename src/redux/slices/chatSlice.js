import { createSlice } from '@reduxjs/toolkit';
import { askQuestion, deleteConversation, fetchConversation } from '../actions/chatActions';
import { isCanceled } from '../createAppThunk';
import { MESSAGES, ROLE } from '../../constants/messages';

/**
 * Not persisted — the transcript is the backend's now, and is re-fetched from
 * `/chat/conversation` on load, so rehydrating a stale copy would only race it.
 *
 * `conversationId` is what every subsequent question is threaded onto; until
 * it arrives the composer stays disabled. `seq` keeps locally-created message
 * ids unique without calling into anything impure from a reducer — they are
 * prefixed so they can never collide with a server id. `lastAsk` is kept so a
 * "still processing" answer can be retried with the same question and document.
 */
const initialState = {
  conversationId: null,
  messages: [],
  loading: false,
  sending: false,
  clearing: false,
  error: null,
  seq: 0,
  lastAsk: null,
};

const pushMessage = (state, role, content, extra = {}) => {
  state.seq += 1;
  state.messages.push({ id: `local-${state.seq}`, role, content, ...extra });
};

/**
 * A stored message, in the shape the transcript renders.
 *
 * History carries none of the transient flags (`streaming`, `failed`, …) — it
 * is settled text — so they are simply absent, and the id falls back to the
 * position only if the backend ever omits one, since React needs a stable key.
 */
const fromServer = (message, index) => ({
  id: message?.id ?? `history-${index}`,
  role: message?.role,
  content: message?.content ?? '',
  createdAt: message?.createdAt,
});

/** The bubble currently being streamed into, if there is one. */
const streamingMessage = (state) => {
  const last = state.messages[state.messages.length - 1];
  return last?.role === ROLE.ASSISTANT && last.streaming ? last : null;
};

/**
 * Close off whatever the agent was doing.
 *
 * Only one step is ever in flight, so anything still open when the next one
 * starts is finished by definition. The backend confirms a tool with its own
 * `tool_finish`, but a status transition, the first token, or the end of the
 * stream all say the same thing implicitly — and a step left open would spin
 * for as long as the transcript is on screen.
 */
const settleSteps = (message) => {
  message.steps.forEach((step) => {
    step.done = true;
  });
};

const pushStep = (message, step) => {
  settleSteps(message);
  message.steps.push({ id: `${message.id}-step-${message.steps.length}`, done: false, ...step });
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
          // What the agent did on the way to this answer, in order.
          steps: [],
        });
      },
      prepare: () => ({ payload: { createdAt: new Date().toISOString() } }),
    },

    /** A general state transition — "Model is reasoning…". */
    answerStatus: (state, action) => {
      const message = streamingMessage(state);
      if (message) pushStep(message, { kind: 'status', label: action.payload });
    },

    /** The agent reached for a tool; the query is what it went looking for. */
    answerToolStarted: (state, action) => {
      const message = streamingMessage(state);
      if (!message) return;

      const { tool, query } = action.payload;
      pushStep(message, { kind: 'tool_start', label: tool, query });
    },

    /**
     * The tool came back. Matched to its own start rather than to whatever is
     * last, so a `tool_finish` that arrives after the agent has already moved
     * on still lands on the step it belongs to.
     */
    answerToolFinished: (state, action) => {
      const message = streamingMessage(state);
      if (!message) return;

      const { tool, message: detail } = action.payload;
      const step = [...message.steps]
        .reverse()
        .find((candidate) => candidate.kind === 'tool_start' && candidate.label === tool);

      if (step) step.done = true;
      pushStep(message, { kind: 'tool_finish', label: tool, detail, event: action.payload, done: true });
    },

    answerRetrieval: (state, action) => {
      const message = streamingMessage(state);
      if (message) pushStep(message, {
        kind: 'retrieval', label: 'Structured retrieval', event: action.payload, done: true,
      });
    },

    answerGraphEvent: (state, action) => {
      const message = streamingMessage(state);
      if (message) pushStep(message, {
        kind: action.payload.type,
        label: action.payload.type.replace(/_/g, ' '),
        event: action.payload,
        done: true,
      });
    },

    answerDone: (state) => {
      const message = streamingMessage(state);
      if (message) pushStep(message, { kind: 'done', label: 'Stream completed', done: true });
    },

    answerStreamError: (state, action) => {
      const message = streamingMessage(state);
      if (message) pushStep(message, {
        kind: 'error', label: 'Stream error', detail: action.payload, done: true,
      });
    },

    /**
     * Appends one fragment. Fragments are raw — never whole words — so they
     * are concatenated exactly as received.
     */
    answerToken: (state, action) => {
      const message = streamingMessage(state);
      if (!message) return;

      // The first fragment is the agent's own proof that it has stopped
      // working and started answering.
      if (!message.content) settleSteps(message);
      message.content += action.payload;
      const last = message.steps[message.steps.length - 1];
      if (last?.kind === 'token') last.count += 1;
      else pushStep(message, { kind: 'token', label: 'Answer tokens', count: 1, done: true });
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
      // The transcript is cleared as soon as the context changes rather than
      // when the new one lands: leaving the previous document's history on
      // screen would misattribute it to the document now selected.
      .addCase(fetchConversation.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.conversationId = null;
        state.messages = [];
        state.lastAsk = null;
      })

      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.conversationId = action.payload?.id ?? null;

        const history = action.payload?.messages;
        state.messages = Array.isArray(history) ? history.map(fromServer) : [];
      })

      .addCase(fetchConversation.rejected, (state, action) => {
        // A cancelled load is the previous document's, superseded by the one
        // now in flight — it must not clear its successor's loading flag (§7.2).
        if (isCanceled(action)) return;
        state.loading = false;
        state.error = action.payload?.message ?? null;
      })

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
        settleSteps(message);

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
        if (message) {
          message.streaming = false;
          settleSteps(message);
        }

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

        // Anything already on screen — answer text or just the "Working…"
        // timeline — is real progress, not noise, so an error must not blank
        // it out. Only a bubble that never streamed anything collapses into
        // the plain failed style.
        if (message.content || message.steps.length > 0) {
          message.interrupted = true;
          message.notice = text ?? MESSAGES.CHAT_ERROR;
        } else {
          message.failed = true;
          message.content = text ?? MESSAGES.CHAT_ERROR;
        }
      })

      .addCase(deleteConversation.pending, (state) => {
        state.clearing = true;
        state.error = null;
      })

      .addCase(deleteConversation.fulfilled, (state) => {
        state.clearing = false;
      })

      .addCase(deleteConversation.rejected, (state, action) => {
        state.clearing = false;
        if (isCanceled(action)) return;
        state.error = action.payload?.message ?? null;
      });
  },
});

export const {
  askedQuestion,
  answerStarted,
  answerStatus,
  answerToolStarted,
  answerToolFinished,
  answerToken,
  answerDone,
  answerStreamError,
  answerRetrieval,
  answerGraphEvent,
  droppedLastAnswer,
  clearChat,
} = chatSlice.actions;

export default chatSlice.reducer;
