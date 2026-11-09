import createAppThunk from '../createAppThunk';
import roleService from '../../services/roleService';
import documentService from '../../services/documentService';

export const fetchRoles = createAppThunk('roles/fetch', (_arg, { signal }) =>
  roleService.getRoles(signal)
);

export const fetchRole = createAppThunk('roles/fetchOne', (roleId, { signal }) =>
  roleService.getRole(roleId, signal)
);

/** Every document in the library (admin only) — the role document picker's options. */
export const fetchLibrary = createAppThunk('roles/fetchLibrary', (_arg, { signal }) =>
  documentService.getLibrary(signal)
);

/** `{ name, description?, documentIds? }` → the full role. */
export const createRole = createAppThunk('roles/create', (payload, { signal }) =>
  roleService.createRole(payload, signal)
);

/**
 * Saves an edit in at most two calls: PATCH for name/description, PUT for the
 * document list (which replaces the whole list). Each is skipped when nothing
 * in it changed — an empty PATCH is a 400 "Nothing to update".
 */
export const saveRole = createAppThunk(
  'roles/save',
  async ({ id, details, documentIds }, { signal }) => {
    let role = null;
    if (details) role = await roleService.updateRole(id, details, signal);
    if (documentIds) role = await roleService.setRoleDocuments(id, documentIds, signal);
    return role;
  }
);

export const deleteRole = createAppThunk('roles/delete', (roleId, { signal }) =>
  roleService.deleteRole(roleId, signal)
);
