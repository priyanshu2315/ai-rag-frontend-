import { configureStore } from '@reduxjs/toolkit';
import {
  createMigrate, persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER,
} from 'redux-persist';
import storage from './persistStorage';
import { combineReducers } from '@reduxjs/toolkit';

import authReducer, { logout, passwordChangeRequired } from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import chatsReducer from './slices/chatsSlice';
import chunkReducer from './slices/chunkSlice';
import documentReducer from './slices/documentSlice';
import pipelineReducer from './slices/pipelineSlice';
import roleReducer from './slices/roleSlice';
import userReducer from './slices/userSlice';
import { registerSession } from './axiosClient';
import { ROUTES } from '../constants/routes';
import notify from '../utils/notify';

/** Auth only (§7.1) — server data is refetched, never rehydrated stale. */
const authMigrations = {
  // v1: the session gained `user.type`. A session saved before that cannot
  // say whether it is an admin, so it signs in again rather than guessing.
  1: (state) => (state?.user && !state.user.type
    ? { ...state, user: null, token: null, isAuthenticated: false }
    : state),
};

const authPersistConfig = {
  key: 'auth',
  storage,
  version: 1,
  migrate: createMigrate(authMigrations, { debug: false }),
  whitelist: ['user', 'token', 'isAuthenticated'],
};

const appReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  chat: chatReducer,
  chats: chatsReducer,
  chunks: chunkReducer,
  documents: documentReducer,
  pipeline: pipelineReducer,
  roles: roleReducer,
  users: userReducer,
});

/**
 * Signing out drops every server-data slice too. Access is per account now,
 * so the next person to sign in on this tab must never glimpse the previous
 * account's documents or chats before their own list arrives.
 */
const rootReducer = (state, action) =>
  appReducer(action.type === logout.type ? { auth: state?.auth } : state, action);

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // redux-persist dispatches non-serializable internals.
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);

/**
 * Close the loop the interceptor left open (§11.2): the axios layer needs the
 * current token, and needs somewhere to send a 401.
 */
registerSession({
  getToken: () => store.getState().auth.token,
  isAuthenticated: () => store.getState().auth.isAuthenticated,

  /** Only ever reached for an expired session, never for a failed sign-in. */
  onUnauthorized: () => {
    store.dispatch(logout());
    persistor.purge();
    notify.error('Your session has expired — please sign in again');
    if (window.location.pathname !== ROUTES.LOGIN) {
      window.location.replace(ROUTES.LOGIN);
    }
  },

  /** `ProtectedRoute` sees the flag and moves the user to the set-password screen. */
  onPasswordChangeRequired: () => {
    store.dispatch(passwordChangeRequired());
  },
});

export default store;
