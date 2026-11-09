import { deleteAPI, getAPI, patchAPI, postAPI, putAPI } from './api';

const path = (roleId) => `/roles/${encodeURIComponent(roleId)}`;

/** Roles — admin only. A role is a name, a description and a set of documents. */
const roleService = {
  /** Summaries: `{ id, name, description, documentCount, userCount, … }`. */
  getRoles: (signal) => getAPI('/roles', { signal }),

  /** Full role with `documents[]` and `users[]`. */
  getRole: (roleId, signal) => getAPI(path(roleId), { signal }),

  createRole: (payload, signal) => postAPI('/roles', payload, { signal }),

  /** `{ name?, description? }` — sending neither is a 400. */
  updateRole: (roleId, changes, signal) => patchAPI(path(roleId), changes, { signal }),

  /** Replaces the role's whole document list; `[]` empties it. */
  setRoleDocuments: (roleId, documentIds, signal) =>
    putAPI(`${path(roleId)}/documents`, { documentIds }, { signal }),

  deleteRole: (roleId, signal) => deleteAPI(path(roleId), { signal }),
};

export default roleService;
