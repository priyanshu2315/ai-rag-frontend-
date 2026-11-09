import { getAPI, patchAPI, postAPI, putAPI } from './api';

const path = (userId) => `/users/${encodeURIComponent(userId)}`;

/** Accounts — admin only. There is no delete: an account is disabled instead. */
const userService = {
  /** `search` matches name or email, case-insensitively; omitted = everyone. */
  getUsers: (search, signal) =>
    getAPI('/users', { params: search ? { search } : undefined, signal }),

  getUser: (userId, signal) => getAPI(path(userId), { signal }),

  /** `{ name, email, temporaryPassword, type?, roleIds? }` */
  createUser: (payload, signal) => postAPI('/users', payload, { signal }),

  /** `{ name?, type?, isActive? }` — sending none is a 400. */
  updateUser: (userId, changes, signal) => patchAPI(path(userId), changes, { signal }),

  /** Replaces the user's whole role list; `[]` leaves them with no documents. */
  setUserRoles: (userId, roleIds, signal) => putAPI(`${path(userId)}/roles`, { roleIds }, { signal }),

  /** New temporary password; the user must change it at next sign-in. */
  resetPassword: (userId, temporaryPassword, signal) =>
    postAPI(`${path(userId)}/reset-password`, { temporaryPassword }, { signal }),
};

export default userService;
