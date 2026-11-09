import createAppThunk from '../createAppThunk';
import { streamChat } from '../../services/chatStream';
import chatService from '../../services/chatService';
import {
  answerStarted,
  answerStatus,
  answerToken,
  answerToolFinished,
  answerToolStarted,
  answerDone,
  answerStreamError,
  answerRetrieval,
  answerGraphEvent,
  chatSessionOf,
  contextKey,
} from '../slices/chatSlice';

/**
 * Loads the conversation for the current context: a document id (that
 * document's chat) or `{ chatId }` (one of the user's global chats).
 *
 * The backend returns the existing session or opens a new one, so this is the
 * only thing that has to happen before the user can send anything: it yields
 * both the `conversationId` the stream needs and the transcript to render.
 */
export const fetchConversation = createAppThunk('chat/conversation', (context, { signal }) =>
  context?.chatId
    ? chatService.getChat(context.chatId, signal)
    : chatService.getConversation(context, signal)
);

/**
 * Deletes the conversation for a context. The hook reloads it right after —
 * the backend creates a fresh one on the next fetch — so this only has to
 * report success or failure, not shape what replaces it.
 */
export const deleteConversation = createAppThunk('chat/deleteConversation', (documentId, { signal }) =>
  chatService.deleteConversation(documentId, signal)
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
export const applyEvent = (rawDispatch, event, key) => {
  // The key says which conversation the event belongs to: the user may have
  // moved to another document while this answer is still being searched.
  const dispatch = (action) => rawDispatch(key === undefined ? action : { ...action, meta: { ...action.meta, key } });
  switch (event.type) {
    case 'status':
      return dispatch(answerStatus(event));
    case 'tool_start':
      return dispatch(answerToolStarted(event));
    case 'tool_finish':
      return dispatch(answerToolFinished(event));
    case 'retrieval':
      return dispatch(answerRetrieval(event));
    case 'retrieval_candidates':
    case 'rerank_result':
    case 'neighbor_expansion':
    case 'grading_result':
    case 'generation_context':
    case 'next_hop':
    case 'rewrite':
    case 'retrieved_chunks':
    case 'citations':
    case 'reasoning_chain':
    case 'step_cost':
    case 'total_usage_summary':
      return dispatch(answerGraphEvent(event));
    case 'done':
      return dispatch(answerDone());
    case 'error':
      return dispatch(answerStreamError(event.message));
    case 'token':
      return dispatch(answerToken(event.text));
    default:
      return undefined;
  }
};

export const askQuestion = createAppThunk(
  'chat/ask',
  async (ask, { signal, dispatch, getState, requestId }) => {
    // `ask` is `{ question, documentId?, chatId? }`: a global chat sends no
    // documentId, so the backend searches every document the user can access.
    const { question, documentId } = ask;
    const { conversationId } = getState().chat;

    const key = contextKey(ask);
    dispatch({ ...answerStarted(), meta: { key } });

    const answer = await streamChat({ question, documentId, conversationId, signal }, (event) =>
      !signal.aborted && chatSessionOf(getState().chat, key)?.answerRequestId === requestId && applyEvent(dispatch, event, key)
    );

    return { answer };
  }
);
