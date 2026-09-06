import createAppThunk from '../createAppThunk';
import { streamChat } from '../../services/chatStream';
import chatService from '../../services/chatService';
import {
  answerStarted,
  answerStatus,
  answerToken,
  answerToolFinished,
  answerToolStarted,
} from '../slices/chatSlice';

/**
 * Loads the conversation for the current context — a single document, or every
 * document when `documentId` is null.
 *
 * The backend returns the existing session or opens a new one, so this is the
 * only thing that has to happen before the user can send anything: it yields
 * both the `conversationId` the stream needs and the transcript to render.
 */
export const fetchConversation = createAppThunk('chat/conversation', (documentId, { signal }) =>
  chatService.getConversation(documentId, signal)
);

/**
 * Streams one answer into the transcript.
 *
 * The empty assistant bubble is created before the request goes out, so the
 * thinking indicator has somewhere to live; each fragment is then appended as
 * it arrives. `thunkAPI.signal` is what the Stop button and unmount cleanup
 * abort — `dispatch(askQuestion(...)).abort()` reaches straight through to the
 * fetch (§6).
 *
 * `conversationId` is read from the store rather than passed in, so a retry —
 * which replays the original `meta.arg` — always uses the conversation that is
 * current now, not the one that was active when the question was first asked.
 */
/**
 * One agent event onto the transcript. The stream speaks the backend's
 * vocabulary; this is where it becomes something the store holds.
 */
const applyEvent = (dispatch, event) => {
  switch (event.type) {
    case 'status':
      return dispatch(answerStatus(event.message));
    case 'tool_start':
      return dispatch(answerToolStarted({ tool: event.tool, query: event.query }));
    case 'tool_finish':
      return dispatch(answerToolFinished({ tool: event.tool, message: event.message }));
    default:
      return dispatch(answerToken(event.text));
  }
};

export const askQuestion = createAppThunk(
  'chat/ask',
  async ({ question, documentId }, { signal, dispatch, getState }) => {
    const { conversationId } = getState().chat;

    dispatch(answerStarted());

    const answer = await streamChat({ question, documentId, conversationId, signal }, (event) =>
      applyEvent(dispatch, event)
    );

    return { answer };
  }
);
