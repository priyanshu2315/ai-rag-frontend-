import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { typeCan, USER_TYPE } from '../constants/permissions';

/** `can(PERMISSIONS.X)` for the signed-in account (§9). */
export const usePermission = () => {
  const type = useSelector((state) => state.auth.user?.type ?? USER_TYPE.USER);
  const can = useCallback((permission) => typeCan(type, permission), [type]);

  return { can, type, isAdmin: type === USER_TYPE.ADMIN };
};

export default usePermission;
