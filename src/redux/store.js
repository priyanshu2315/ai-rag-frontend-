import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer, FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER } from 'redux-persist';
import storage from './persistStorage';
import { combineReducers } from '@reduxjs/toolkit';

import authReducer, { logout } from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import documentReducer from './slices/documentSlice';
import { registerSession } from './axiosClient';
import { ROUTES } from '../constants/routes';
import notify from '../utils/notify';

/** Auth only (§7.1) — server data is refetched, never rehydrated stale. */
const authPersistConfig = {
  key: 'auth',
  storage,
  whitelist: ['user', 'token', 'isAuthenticated'],
};

const rootReducer = combineReducers({
  auth: persistReducer(authPersistConfig, authReducer),
  chat: chatReducer,
  documents: documentReducer,
});

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
});

export default store;
