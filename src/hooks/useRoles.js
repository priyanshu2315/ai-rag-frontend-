import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createRole, deleteRole, fetchLibrary, fetchRole, fetchRoles, saveRole,
} from '../redux/actions/roleActions';
import { clearCurrentRole } from '../redux/slices/roleSlice';
import notify from '../utils/notify';

/** The role list, loaded on mount and aborted on unmount (§6). */
export const useRoles = () => {
  const dispatch = useDispatch();
  const { list, loaded, loading, error, deletingId } = useSelector((state) => state.roles);

  useEffect(() => {
    const promise = dispatch(fetchRoles());
    return () => promise.abort();
  }, [dispatch]);

  const reload = useCallback(() => dispatch(fetchRoles()), [dispatch]);

  const remove = useCallback(async (role) => {
    const result = await dispatch(deleteRole(role.id));
    const ok = deleteRole.fulfilled.match(result);
    if (ok) notify.deleted(`Role “${role.name}”`);
    return ok;
  }, [dispatch]);

  return { roles: list, loaded, loading, error, deletingId, reload, remove };
};

const sameIds = (a = [], b = []) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/**
 * Everything the role editor needs: the role (edit) and the library to pick
 * documents from. `current` is cleared on leave so it never seeds a new role
 * (§7.3).
 */
export const useRoleEditor = (roleId) => {
  const dispatch = useDispatch();
  const {
    current, currentLoading, currentError, saving, deletingId, library, libraryLoading, libraryError,
  } = useSelector((state) => state.roles);

  useEffect(() => {
    const promise = dispatch(fetchLibrary());
    return () => promise.abort();
  }, [dispatch]);

  useEffect(() => {
    if (!roleId) {
      dispatch(clearCurrentRole());
      return undefined;
    }
    const promise = dispatch(fetchRole(roleId));
    return () => {
      promise.abort();
      dispatch(clearCurrentRole());
    };
  }, [dispatch, roleId]);

  const reload = useCallback(() => roleId && dispatch(fetchRole(roleId)), [dispatch, roleId]);

  /** Resolves to the saved role, or null. Sends only what changed. */
  const save = useCallback(async (values) => {
    const name = values.name.trim();
    const description = values.description?.trim() || null;

    if (!roleId) {
      const result = await dispatch(createRole({ name, description, documentIds: values.documentIds }));
      if (!createRole.fulfilled.match(result)) return null;
      notify.created(`Role “${name}”`);
      return result.payload;
    }

    const details = {};
    if (name !== current.name) details.name = name;
    if (description !== (current.description ?? null)) details.description = description;
    const currentIds = (current.documents ?? []).map((doc) => doc.id);

    const changes = {
      id: roleId,
      details: Object.keys(details).length ? details : null,
      documentIds: sameIds(values.documentIds, currentIds) ? null : values.documentIds,
    };
    if (!changes.details && !changes.documentIds) {
      notify.info('No changes to save');
      return current;
    }

    const result = await dispatch(saveRole(changes));
    if (!saveRole.fulfilled.match(result)) return null;
    notify.saved(`Role “${name}”`);
    return result.payload;
  }, [dispatch, roleId, current]);

  const remove = useCallback(async () => {
    const result = await dispatch(deleteRole(roleId));
    const ok = deleteRole.fulfilled.match(result);
    if (ok) notify.deleted(`Role “${current?.name ?? ''}”`);
    return ok;
  }, [dispatch, roleId, current]);

  return {
    role: roleId ? current : null,
    loading: Boolean(roleId) && (currentLoading || (!current && !currentError)),
    error: currentError,
    saving,
    deleting: Boolean(deletingId),
    library,
    libraryLoading,
    libraryError,
    reload,
    save,
    remove,
  };
};
