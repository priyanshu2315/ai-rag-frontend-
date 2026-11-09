import createAppThunk from '../createAppThunk';
import userService from '../../services/userService';

/** `search` is the parsed `?search=` from the URL (§6); empty = everyone. */
export const fetchUsers = createAppThunk('users/fetch', (search, { signal }) =>
  userService.getUsers(search, signal)
);

export const fetchUser = createAppThunk('users/fetchOne', (userId, { signal }) =>
  userService.getUser(userId, signal)
);

/** `{ name, email, temporaryPassword, type, roleIds }` → the new user. */
export const createUser = createAppThunk('users/create', (payload, { signal }) =>
  userService.createUser(payload, signal)
);

/**
 * Saves an edit in at most two calls: PATCH for name/type, PUT for roles
 * (which replaces the whole list). Unchanged parts are skipped — an empty
 * PATCH is a 400 "Nothing to update".
 */
export const saveUser = createAppThunk(
  'users/save',
  async ({ id, details, roleIds }, { signal }) => {
    let user = null;
    if (details) user = await userService.updateUser(id, details, signal);
    if (roleIds) user = await userService.setUserRoles(id, roleIds, signal);
    return user;
  }
);

/** Disable (`false`) or re-enable (`true`). A disabled user's next request is a 401. */
export const setUserActive = createAppThunk('users/setActive', ({ id, isActive }, { signal }) =>
  userService.updateUser(id, { isActive }, signal)
);

export const resetUserPassword = createAppThunk(
  'users/resetPassword',
  ({ id, temporaryPassword }, { signal }) => userService.resetPassword(id, temporaryPassword, signal)
);
