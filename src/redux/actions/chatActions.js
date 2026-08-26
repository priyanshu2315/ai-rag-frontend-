import createAppThunk from '../createAppThunk';
import { streamChat } from '../../services/chatStream';
import { answerStarted, answerToken } from '../slices/chatSlice';

/**
 * Streams one answer into the transcript.
 *
 * The empty assistant bubble is created before the request goes out, so the
 * thinking indicator has somewhere to live; each fragment is then appended as
 * it arrives. `thunkAPI.signal` is what the Stop button and unmount cleanup
 * abort — `dispatch(askQuestion(...)).abort()` reaches straight through to the
 * fetch (§6).
 */
export const askQuestion = createAppThunk(
  'chat/ask',
  async ({ question, documentId }, { signal, dispatch }) => {
    dispatch(answerStarted());

    const answer = await streamChat({ question, documentId, signal }, (fragment) =>
      dispatch(answerToken(fragment))
    );

    return { answer };
  }
);
