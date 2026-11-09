import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import { createServer } from 'vite';

// The session rules from the users/roles backend contract (Steps 4–6):
// which failures sign out, which stay on the form, and how the forced
// password change is reached. HTTP is replaced at the Axios adapter.

let vite;
let client;
let originalAdapter;
let actions;
let authReducer;
let authSlice;
let typeCan;
let PERMISSIONS;
let signedIn = true;
const calls = { unauthorized: 0, passwordRequired: 0, toasts: [] };

const reply = (status, data) => async (config) => {
  if (status < 400) return { data, status, statusText: 'OK', headers: {}, config };
  const error = new Error(`Request failed with status code ${status}`);
  error.config = config;
  error.response = { data, status, headers: {}, config };
  error.code = 'ERR_BAD_REQUEST';
  throw error;
};

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  const api = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  client = api.default;
  originalAdapter = client.defaults.adapter;
  api.registerSession({
    getToken: () => 'test-token',
    isAuthenticated: () => signedIn,
    onUnauthorized: () => { calls.unauthorized += 1; },
    onPasswordChangeRequired: () => { calls.passwordRequired += 1; },
  });
  const { default: notify } = await vite.ssrLoadModule('/src/utils/notify.js');
  notify.error = (message) => calls.toasts.push(message);
  actions = await vite.ssrLoadModule('/src/redux/actions/authActions.js');
  authSlice = await vite.ssrLoadModule('/src/redux/slices/authSlice.js');
  authReducer = authSlice.default;
  ({ typeCan, PERMISSIONS } = await vite.ssrLoadModule('/src/constants/permissions.js'));
});

after(async () => {
  if (client) client.defaults.adapter = originalAdapter;
  await vite?.close();
});

beforeEach(() => {
  signedIn = true;
  calls.unauthorized = 0;
  calls.passwordRequired = 0;
  calls.toasts = [];
});

const makeStore = () => configureStore({ reducer: { auth: authReducer } });

test('login stores type and mustChangePassword, and a null name stays null', async () => {
  signedIn = false;
  client.defaults.adapter = reply(200, {
    token: 'jwt', userId: 'u1', email: 'a@b.c', name: null, type: 'ADMIN', mustChangePassword: true,
  });
  const store = makeStore();
  await store.dispatch(actions.login({ email: 'a@b.c', password: 'x' }));

  assert.deepEqual(store.getState().auth.user, {
    userId: 'u1', email: 'a@b.c', name: null, type: 'ADMIN', mustChangePassword: true,
  });
  assert.equal(store.getState().auth.isAuthenticated, true);
});

test('a login without a type is treated as a normal user', async () => {
  signedIn = false;
  client.defaults.adapter = reply(200, { token: 'jwt', userId: 'u1', email: 'a@b.c' });
  const store = makeStore();
  await store.dispatch(actions.login({ email: 'a@b.c', password: 'x' }));

  assert.equal(store.getState().auth.user.type, 'USER');
  assert.equal(store.getState().auth.user.mustChangePassword, false);
});

test('wrong credentials and a disabled account stay on the form: no toast, no sign-out', async () => {
  signedIn = false;
  const store = makeStore();

  client.defaults.adapter = reply(401, { error: 'Invalid credentials' });
  await store.dispatch(actions.login({ email: 'a@b.c', password: 'bad' }));
  assert.deepEqual(store.getState().auth.error, { status: 401, message: 'Invalid credentials' });

  client.defaults.adapter = reply(403, { error: 'Account is disabled' });
  await store.dispatch(actions.login({ email: 'a@b.c', password: 'x' }));
  assert.deepEqual(store.getState().auth.error, { status: 403, message: 'Account is disabled' });

  assert.equal(calls.toasts.length, 0);
  assert.equal(calls.unauthorized, 0);
});

test('a wrong current password does not end the session', async () => {
  client.defaults.adapter = reply(401, { success: false, error: 'Current password is incorrect' });
  const store = makeStore();
  await store.dispatch(actions.changePassword({ currentPassword: 'bad', newPassword: 'newpassword' }));

  assert.equal(calls.unauthorized, 0);
  assert.equal(calls.toasts.length, 0);
  assert.deepEqual(store.getState().auth.passwordChange.error, {
    status: 401, message: 'Current password is incorrect',
  });
});

test('a successful change clears mustChangePassword and keeps the token', async () => {
  signedIn = false;
  client.defaults.adapter = reply(200, {
    token: 'jwt', userId: 'u1', email: 'a@b.c', type: 'USER', mustChangePassword: true,
  });
  const store = makeStore();
  await store.dispatch(actions.login({ email: 'a@b.c', password: 'temp' }));

  signedIn = true;
  client.defaults.adapter = reply(200, { success: true, message: 'Password changed' });
  await store.dispatch(actions.changePassword({ currentPassword: 'temp', newPassword: 'newpassword' }));

  assert.equal(store.getState().auth.user.mustChangePassword, false);
  assert.equal(store.getState().auth.token, 'jwt');
});

test('any other 401 while signed in still signs out', async () => {
  client.defaults.adapter = reply(401, { error: 'Unauthorized: Account not active' });
  await client.get('/documents/my-documents').catch(() => {});

  assert.equal(calls.unauthorized, 1);
});

test('PASSWORD_CHANGE_REQUIRED routes to set-password instead of a permission toast', async () => {
  client.defaults.adapter = reply(403, { error: 'Password change required', code: 'PASSWORD_CHANGE_REQUIRED' });
  const failure = await client.get('/documents/my-documents').catch((error) => error);

  assert.equal(calls.passwordRequired, 1);
  assert.equal(calls.toasts.length, 0);
  assert.equal(failure.code, 'PASSWORD_CHANGE_REQUIRED');
});

test('an admin-only 403 says "no permission" and does not sign out', async () => {
  client.defaults.adapter = reply(403, { error: 'Forbidden: Admin only' });
  await client.post('/documents/upload', {}).catch(() => {});

  assert.equal(calls.unauthorized, 0);
  assert.deepEqual(calls.toasts, ["You don't have permission to do that"]);
});

test('passwordChangeRequired flips the flag on a signed-in user', () => {
  const state = authReducer(
    { ...authReducer(undefined, { type: 'init' }), user: { userId: 'u1', type: 'USER', mustChangePassword: false } },
    authSlice.passwordChangeRequired()
  );
  assert.equal(state.user.mustChangePassword, true);
});

test('admin-only capabilities follow the user type', () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(typeCan('ADMIN', permission), true);
    assert.equal(typeCan('USER', permission), false);
    assert.equal(typeCan(undefined, permission), false);
  }
});

test('forgot-password: the unknown-email 500 is silent and reads as sent; the dev otp is never kept', async () => {
  signedIn = false;
  const store = makeStore();

  client.defaults.adapter = reply(500, { success: false, error: "Cannot read properties of null (reading 'otp')" });
  const failed = await store.dispatch(actions.forgotPassword({ email: 'nobody@example.com' }));
  assert.equal(failed.payload.status, 500);
  assert.equal(calls.toasts.length, 0);
  assert.equal(store.getState().auth.passwordReset.error, null);

  client.defaults.adapter = reply(200, { success: true, message: 'If the account exists, a reset code has been sent.', otp: '123456' });
  await store.dispatch(actions.forgotPassword({ email: 'a@b.c' }));
  assert.equal(JSON.stringify(store.getState().auth).includes('123456'), false);
});
