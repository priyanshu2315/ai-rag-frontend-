import { Outlet, useOutletContext } from 'react-router-dom';
import { ShieldOff } from 'lucide-react';
import EmptyState from '../components/feedback/EmptyState';
import usePermission from '../hooks/usePermission';

/**
 * Gates a module on a permission (§9). A typed-in URL for a module the account
 * cannot use shows a permission-denied state instead of a blank page. The
 * backend enforces the same rule with a 403, so this is only the UI half.
 */
const RoleRoute = ({ requires }) => {
  const { can } = usePermission();
  // A layout route's <Outlet/> starts a fresh context, so the shell's
  // (documents, upload, …) has to be handed on explicitly.
  const shellContext = useOutletContext();

  if (!can(requires)) {
    return (
      <EmptyState
        className="flex-1"
        icon={ShieldOff}
        title="You don't have permission"
        description="This module is for administrators. Ask an admin if you need access."
      />
    );
  }

  return <Outlet context={shellContext} />;
};

export default RoleRoute;
