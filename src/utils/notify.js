import toast from 'react-hot-toast';

/**
 * The single place success/info toasts are phrased (§11.2).
 * Errors are raised centrally by the axios interceptor — components never
 * toast an error themselves.
 */
export const notify = {
  success: (message) => toast.success(message),
  info: (message) => toast(message),
  error: (message) => toast.error(message),

  saved: (entity) => toast.success(`${entity} saved`),
  created: (entity) => toast.success(`${entity} created`),
  deleted: (entity) => toast.success(`${entity} deleted`),
  uploaded: (name) => toast.success(`${name} uploaded`),
};

export default notify;
