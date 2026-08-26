import { createAsyncThunk } from '@reduxjs/toolkit';

/**
 * True for an intentional abort, whatever cancelled it.
 *
 * Axios rejects with `ERR_CANCELED`; `fetch` (the streaming chat call) rejects
 * with a DOMException named `AbortError`. Both mean "we stopped this on
 * purpose" and neither is an error the user should be told about.
 */
const isAbortError = (error) =>
  Boolean(error?.canceled) || error?.code === 'ERR_CANCELED' || error?.name === 'AbortError';

/**
 * One try/catch for the whole app (§7.2).
 *
 * Individual thunks must NOT write their own try/catch: the axios layer has
 * already normalised and toasted the error, so all that is left is to shape
 * the rejection. Cancellations are flagged so reducers can ignore them.
 */
export const createAppThunk = (type, fn) =>
  createAsyncThunk(type, async (arg, thunkAPI) => {
    try {
      return await fn(arg, thunkAPI);
    } catch (error) {
      if (isAbortError(error)) {
        return thunkAPI.rejectWithValue({ canceled: true });
      }
      return thunkAPI.rejectWithValue({
        code: error?.code,
        status: error?.status,
        retryable: Boolean(error?.retryable),
        message: error?.message || 'Something went wrong. Please try again.',
      });
    }
  });

/**
 * True when a rejection is an intentional abort rather than a failure.
 *
 * There are two ways to land here, and both must be caught:
 *   - the payload creator saw the abort and rejected with `{ canceled: true }`
 *   - `dispatch(thunk()).abort()` was called, in which case RTK rejects the
 *     action itself with `meta.aborted` and **no payload at all** — the
 *     `rejectWithValue` above loses that race.
 *
 * Checking only the payload makes every `.abort()` look like a real failure,
 * which is how a cancelled request ends up setting `error` (§6, §7.2).
 */
export const isCanceled = (action) =>
  Boolean(action.payload?.canceled) || Boolean(action.meta?.aborted);

export default createAppThunk;
