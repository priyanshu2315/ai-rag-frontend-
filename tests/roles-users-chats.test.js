import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { configureStore } from '@reduxjs/toolkit';
import { createServer } from 'vite';

// Steps 8–14 of the users/roles backend contract: request shapes for roles,
// users and global chats, "send only what changed" on edits, global chats
// keyed apart from documents, and documents dropped when access is lost.
// HTTP is replaced at the Axios adapter.

let vite;
let client;
let originalAdapter;
let toasts = [];
let requests = [];
let responder = () => ({ status: 200, data: {} });
const m = {};

before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  });
  const api = await vite.ssrLoadModule('/src/redux/axiosClient.js');
  client = api.default;
  originalAdapter = client.defaults.adapter;
  api.registerSession({ getToken: () => 'admin-jwt', isAuthenticated: () => true, onUnauthorized: () => {} });
  const { default: notify } = await vite.ssrLoadModule('/src/utils/notify.js');
  notify.error = (message) => toasts.push(message);

  client.defaults.adapter = async (config) => {
    requests.push({ method: config.method, url: config.url, params: config.params, data: config.data && JSON.parse(config.data) });
    const { status, data } = responder(config);
    if (status < 400) return { data, status, statusText: 'OK', headers: {}, config };
    const error = new Error(`Request failed with status code ${status}`);
    error.config = config;
    error.response = { data, status, headers: {}, config };
    throw error;
  };

  for (const [name, path] of Object.entries({
    roleActions: '/src/redux/actions/roleActions.js',
    userActions: '/src/redux/actions/userActions.js',
    chatsActions: '/src/redux/actions/chatsActions.js',
    chatActions: '/src/redux/actions/chatActions.js',
    documentActions: '/src/redux/actions/documentActions.js',
    chatSlice: '/src/redux/slices/chatSlice.js',
    chatsSlice: '/src/redux/slices/chatsSlice.js',
    roleSlice: '/src/redux/slices/roleSlice.js',
    userSlice: '/src/redux/slices/userSlice.js',
    documentSlice: '/src/redux/slices/documentSlice.js',
    roles: '/src/utils/roles.js',
    password: '/src/utils/password.js',
  })) m[name] = await vite.ssrLoadModule(path);
});

after(async () => {
  if (client) client.defaults.adapter = originalAdapter;
  await vite?.close();
});

beforeEach(() => {
  toasts = [];
  requests = [];
  responder = () => ({ status: 200, data: {} });
});

const store = () => configureStore({
  reducer: {
    chat: m.chatSlice.default,
    chats: m.chatsSlice.default,
    roles: m.roleSlice.default,
    users: m.userSlice.default,
    documents: m.documentSlice.default,
  },
});

/* ── Roles ──────────────────────────────────────────────────────────────── */

test('saveRole sends PATCH and/or PUT only for the parts that changed', async () => {
  const s = store();
  const role = { id: 'r1', name: 'Finance', documents: [{ id: 'd1' }], users: [] };
  responder = () => ({ status: 200, data: role });

  await s.dispatch(m.roleActions.saveRole({ id: 'r1', details: null, documentIds: ['d1', 'd2'] }));
  assert.deepEqual(requests.map((r) => [r.method, r.url, r.data]), [['put', '/roles/r1/documents', { documentIds: ['d1', 'd2'] }]]);

  requests = [];
  await s.dispatch(m.roleActions.saveRole({ id: 'r1', details: { name: 'Fin' }, documentIds: null }));
  assert.deepEqual(requests.map((r) => [r.method, r.url, r.data]), [['patch', '/roles/r1', { name: 'Fin' }]]);
});

test('a created role appears in the list with counts from its full shape', async () => {
  const s = store();
  responder = () => ({ status: 201, data: { id: 'r9', name: 'Legal', documents: [{ id: 'a' }, { id: 'b' }], users: [] } });
  await s.dispatch(m.roleActions.createRole({ name: 'Legal', documentIds: ['a', 'b'] }));

  assert.deepEqual(requests[0].data, { name: 'Legal', documentIds: ['a', 'b'] });
  assert.equal(s.getState().roles.list[0].documentCount, 2);
  assert.equal(s.getState().roles.list[0].userCount, 0);
});

test('deleting a role warns with the number of users who lose access', () => {
  assert.match(m.roles.roleDeleteMessage({ userCount: 2, documentCount: 3 }), /^2 users will lose access to this role's 3 documents/);
  assert.match(m.roles.roleDeleteMessage({ users: [], documents: [] }), /nobody loses access/);
});

test('the role picker reads the whole library from GET /documents', async () => {
  const s = store();
  responder = () => ({ status: 200, data: { success: true, data: [{ id: 'd1', filename: 'a.pdf' }] } });
  await s.dispatch(m.roleActions.fetchLibrary());

  assert.equal(requests[0].url, '/documents');
  assert.equal(s.getState().roles.library.length, 1);
});

/* ── Users ──────────────────────────────────────────────────────────────── */

test('user search is sent as ?search= and omitted when empty', async () => {
  const s = store();
  responder = () => ({ status: 200, data: [] });
  await s.dispatch(m.userActions.fetchUsers('asha'));
  await s.dispatch(m.userActions.fetchUsers(''));

  assert.deepEqual(requests.map((r) => r.params), [{ search: 'asha' }, undefined]);
});

test('disabling updates the row in place; roles are replaced with PUT', async () => {
  const s = store();
  const user = { id: 'u1', name: 'Asha', isActive: true, roles: [] };
  responder = () => ({ status: 200, data: [user] });
  await s.dispatch(m.userActions.fetchUsers(''));

  responder = () => ({ status: 200, data: { ...user, isActive: false } });
  await s.dispatch(m.userActions.setUserActive({ id: 'u1', isActive: false }));
  assert.deepEqual(requests.at(-1).data, { isActive: false });
  assert.equal(s.getState().users.list[0].isActive, false);

  responder = () => ({ status: 200, data: { ...user, isActive: false, roles: [{ id: 'r1' }] } });
  await s.dispatch(m.userActions.saveUser({ id: 'u1', details: null, roleIds: ['r1'] }));
  assert.deepEqual([requests.at(-1).method, requests.at(-1).url, requests.at(-1).data], ['put', '/users/u1/roles', { roleIds: ['r1'] }]);
});

test('reset password posts the new temporary password', async () => {
  const s = store();
  responder = () => ({ status: 200, data: { id: 'u1', mustChangePassword: true } });
  await s.dispatch(m.userActions.resetUserPassword({ id: 'u1', temporaryPassword: 'Temp-pass-123' }));

  assert.deepEqual([requests[0].method, requests[0].url, requests[0].data], ['post', '/users/u1/reset-password', { temporaryPassword: 'Temp-pass-123' }]);
});

test('generated temporary passwords are long enough and avoid look-alike characters', () => {
  for (let i = 0; i < 50; i += 1) {
    const value = m.password.generateTemporaryPassword();
    assert.equal(value.length, 14);
    assert.doesNotMatch(value, /[0O1lI]/);
  }
});

/* ── Global chats ───────────────────────────────────────────────────────── */

test('a global chat loads from /chat/conversations/:id and is keyed apart from documents', async () => {
  const s = store();
  responder = () => ({ status: 200, data: { id: 'g1', type: 'GLOBAL', messages: [] } });
  await s.dispatch(m.chatActions.fetchConversation({ chatId: 'g1' }));

  assert.equal(requests[0].url, '/chat/conversations/g1');
  assert.equal(s.getState().chat.activeKey, 'chat:g1');
  assert.equal(s.getState().chat.conversationId, 'g1');
  assert.notEqual(m.chatSlice.contextKey({ chatId: 'd1' }), m.chatSlice.contextKey('d1'));
  // An ask in a global chat keys the same way as the load that opened it.
  assert.equal(m.chatSlice.contextKey({ question: 'q', chatId: 'g1' }), 'chat:g1');
});

test('chats: create prepends, rename updates the title, delete removes', async () => {
  const s = store();
  responder = () => ({ status: 201, data: { id: 'g2', title: 'New Conversation', updatedAt: '2026-11-09T10:00:00Z' } });
  await s.dispatch(m.chatsActions.createChat({}));
  assert.equal(requests[0].url, '/chat/conversations');
  assert.equal(s.getState().chats.list[0].id, 'g2');

  responder = () => ({ status: 200, data: { id: 'g2', title: 'Budget' } });
  await s.dispatch(m.chatsActions.renameChat({ id: 'g2', title: 'Budget' }));
  assert.deepEqual([requests.at(-1).method, requests.at(-1).data], ['patch', { title: 'Budget' }]);
  assert.equal(s.getState().chats.list[0].title, 'Budget');

  responder = () => ({ status: 200, data: { success: true } });
  await s.dispatch(m.chatsActions.deleteChat('g2'));
  assert.equal(s.getState().chats.list.length, 0);
});

test('chats are listed most recently used first', () => {
  const state = { chats: { list: [
    { id: 'old', updatedAt: '2026-11-01T00:00:00Z' },
    { id: 'new', updatedAt: '2026-11-09T00:00:00Z' },
  ] } };
  assert.deepEqual(m.chatsSlice.selectChats(state).map((chat) => chat.id), ['new', 'old']);
});

test('opening a deleted global chat flags notFound and drops it from the list, without a toast', async () => {
  const s = store();
  responder = () => ({ status: 200, data: [{ id: 'gone', title: 'x' }] });
  await s.dispatch(m.chatsActions.fetchChats());

  responder = () => ({ status: 404, data: { error: 'Conversation not found' } });
  await s.dispatch(m.chatActions.fetchConversation({ chatId: 'gone' }));

  assert.equal(s.getState().chat.notFound, true);
  assert.equal(s.getState().chats.list.length, 0);
  assert.deepEqual(toasts, []);
});

/* ── Documents follow roles ─────────────────────────────────────────────── */

test('a 404 on a document chat drops that document (access removed), quietly', async () => {
  const s = store();
  responder = () => ({ status: 200, data: { success: true, data: [{ id: 'd1', filename: 'a.pdf' }, { id: 'd2', filename: 'b.pdf' }] } });
  await s.dispatch(m.documentActions.fetchDocuments());

  responder = () => ({ status: 404, data: { error: 'Document not found.' } });
  await s.dispatch(m.chatActions.fetchConversation('d1'));

  assert.deepEqual(s.getState().documents.list.map((doc) => doc.id), ['d2']);
  // Not a deletion: the route check announces "no longer available" for it.
  assert.deepEqual(s.getState().documents.deletedIds, []);
  assert.deepEqual(toasts, []);
});

test('other failures on a document do not drop it', async () => {
  const s = store();
  responder = () => ({ status: 200, data: { success: true, data: [{ id: 'd1', filename: 'a.pdf' }] } });
  await s.dispatch(m.documentActions.fetchDocuments());

  responder = () => ({ status: 500, data: { error: 'Something went wrong' } });
  await s.dispatch(m.chatActions.fetchConversation('d1'));

  assert.equal(s.getState().documents.list.length, 1);
  assert.deepEqual(toasts, ['Something went wrong']);
});

/* ── Loading flags survive a superseded request ─────────────────────────── */

test('a cancelled list request does not clear the loading flag of the one replacing it', () => {
  const docs = m.documentSlice.default;
  const roles = m.roleSlice.default;
  const chats = m.chatsSlice.default;
  const aborted = { payload: undefined, meta: { aborted: true } };

  for (const [reducer, thunk] of [
    [docs, m.documentActions.fetchDocuments],
    [roles, m.roleActions.fetchRoles],
    [chats, m.chatsActions.fetchChats],
  ]) {
    // StrictMode order: first pending, second pending, THEN the first's abort lands.
    let state = reducer(undefined, thunk.pending('first'));
    state = reducer(state, thunk.pending('second'));
    state = reducer(state, { ...thunk.rejected(null, 'first'), ...aborted, meta: { ...thunk.rejected(null, 'first').meta, aborted: true } });
    assert.equal(state.loading, true, thunk.typePrefix);
    assert.equal(state.error, null, thunk.typePrefix);
  }
});

/* ── Login details are emailed (emailSent) ──────────────────────────────── */

test('emailSent is read beside the user fields or around a nested user, and kept out of the stored user', async () => {
  const { splitEmailResult } = await vite.ssrLoadModule('/src/utils/users.js');
  const user = { id: 'u7', email: 'ravi@example.com' };

  assert.deepEqual(splitEmailResult({ ...user, emailSent: true }), { user, emailSent: true });
  assert.deepEqual(splitEmailResult({ user, emailSent: false }), { user, emailSent: false });
  // Not reported → null, which the UI treats as "show the password".
  assert.deepEqual(splitEmailResult(user), { user, emailSent: null });

  const s = store();
  responder = () => ({ status: 201, data: { ...user, emailSent: true } });
  await s.dispatch(m.userActions.createUser({ name: 'Ravi', email: 'ravi@example.com', temporaryPassword: 'x'.repeat(10) }));
  assert.equal('emailSent' in s.getState().users.list[0], false);
});
