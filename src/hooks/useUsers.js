import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createUser, fetchUser, fetchUsers, resetUserPassword, saveUser, setUserActive,
} from '../redux/actions/userActions';
import { fetchRoles } from '../redux/actions/roleActions';
import { clearCurrentUser } from '../redux/slices/userSlice';
import notify from '../utils/notify';
import { splitEmailResult } from '../utils/users';

const nameOf = (user) => user?.name || user?.email || 'User';

/**
 * Row actions shared by the list and the editor. Each resolves to the updated
 * user, or null; failures were already toasted by the axios layer.
 */
const useUserActions = () => {
  const dispatch = useDispatch();
  const actingId = useSelector((state) => state.users.actingId);

  const setActive = useCallback(async (user, isActive) => {
    const result = await dispatch(setUserActive({ id: user.id, isActive }));
    if (!setUserActive.fulfilled.match(result)) return null;
    notify.success(`${nameOf(user)} ${isActive ? 'enabled' : 'disabled'}`);
    return result.payload;
  }, [dispatch]);

  /** Resolves to `{ user, emailSent }`, or null if the reset failed. */
  const resetPassword = useCallback(async (user, temporaryPassword) => {
    const result = await dispatch(resetUserPassword({ id: user.id, temporaryPassword }));
    return resetUserPassword.fulfilled.match(result) ? splitEmailResult(result.payload) : null;
  }, [dispatch]);

  return { actingId, setActive, resetPassword };
};

/**
 * The user list for one search. `search` is the URL's (§6), already
 * debounced by the page; a new search aborts the request still in flight.
 */
export const useUsers = (search) => {
  const dispatch = useDispatch();
  const { list, loaded, loading, error } = useSelector((state) => state.users);
  const actions = useUserActions();

  useEffect(() => {
    const promise = dispatch(fetchUsers(search));
    return () => promise.abort();
  }, [dispatch, search]);

  const reload = useCallback(() => dispatch(fetchUsers(search)), [dispatch, search]);

  return { users: list, loaded, loading, error, reload, ...actions };
};

const sameIds = (a = [], b = []) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** The create/edit page: the user (edit), the roles to pick from, and save. */
export const useUserEditor = (userId) => {
  const dispatch = useDispatch();
  const { current, currentLoading, currentError, saving } = useSelector((state) => state.users);
  const roles = useSelector((state) => state.roles.list);
  const rolesLoading = useSelector((state) => state.roles.loading);
  const actions = useUserActions();

  useEffect(() => {
    const promise = dispatch(fetchRoles());
    return () => promise.abort();
  }, [dispatch]);

  useEffect(() => {
    if (!userId) {
      dispatch(clearCurrentUser());
      return undefined;
    }
    const promise = dispatch(fetchUser(userId));
    return () => {
      promise.abort();
      dispatch(clearCurrentUser());
    };
  }, [dispatch, userId]);

  const reload = useCallback(() => userId && dispatch(fetchUser(userId)), [dispatch, userId]);

  /**
   * Resolves to `{ user, emailSent }` (emailSent only on create), or null.
   * Edits send only what changed.
   */
  const save = useCallback(async (values) => {
    const name = values.name.trim();

    if (!userId) {
      const result = await dispatch(createUser({
        name,
        email: values.email.trim(),
        temporaryPassword: values.temporaryPassword,
        type: values.type,
        roleIds: values.roleIds,
      }));
      if (!createUser.fulfilled.match(result)) return null;
      // The page announces it: "emailed" or "share these details yourself".
      return splitEmailResult(result.payload);
    }

    const details = {};
    if (name !== (current.name ?? '')) details.name = name;
    if (values.type !== current.type) details.type = values.type;
    const currentRoleIds = (current.roles ?? []).map((role) => role.id);

    const changes = {
      id: userId,
      details: Object.keys(details).length ? details : null,
      roleIds: sameIds(values.roleIds, currentRoleIds) ? null : values.roleIds,
    };
    if (!changes.details && !changes.roleIds) {
      notify.info('No changes to save');
      return { user: current, emailSent: null };
    }

    const result = await dispatch(saveUser(changes));
    if (!saveUser.fulfilled.match(result)) return null;
    notify.saved(name);
    return { user: result.payload, emailSent: null };
  }, [dispatch, userId, current]);

  return {
    user: userId ? current : null,
    loading: Boolean(userId) && (currentLoading || (!current && !currentError)),
    error: currentError,
    saving,
    roles,
    rolesLoading,
    reload,
    save,
    ...actions,
  };
};
