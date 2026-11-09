/**
 * What a signed-in account may do, by capability (§9).
 *
 * Components ask `can(PERMISSIONS.UPLOAD_DOCUMENT)`, never `type === 'ADMIN'`.
 * Today the backend only sends a user type, so every capability below maps to
 * ADMIN — this map is the one place that changes if it starts sending a
 * permission list instead.
 *
 * Hiding a control is a convenience, not security: the backend enforces every
 * one of these with a 403.
 */
export const USER_TYPE = {
  ADMIN: 'ADMIN',
  USER: 'USER',
};

export const PERMISSIONS = {
  UPLOAD_DOCUMENT: 'document.upload',
  DELETE_DOCUMENT: 'document.delete',
  MANAGE_ROLES: 'role.manage',
  MANAGE_USERS: 'user.manage',
};

const ADMIN_ONLY = new Set(Object.values(PERMISSIONS));

/** True when an account of `type` holds `permission`. */
export const typeCan = (type, permission) =>
  ADMIN_ONLY.has(permission) ? type === USER_TYPE.ADMIN : Boolean(type);
