import toast from 'react-hot-toast';
import errorText from './errorText';

/**
 * The single place success/info toasts are phrased (§11.2).
 * Errors are raised centrally by the axios interceptor — components never
 * toast an error themselves.
 *
 * `error` takes whatever it is given through `errorText` as a last line of
 * defence: a toast renders its argument as a React child, so an object landing
 * here throws during render and unmounts the app. The callers normalise
 * already; this makes it impossible to get wrong.
 */
export const notify = {
  success: (message) => toast.success(message),
  info: (message) => toast(message),
  error: (message) => toast.error(errorText(message)),

  saved: (entity) => toast.success(`${entity} saved`),
  created: (entity) => toast.success(`${entity} created`),
  deleted: (entity) => toast.success(`${entity} deleted`),
  uploaded: (name) => toast.success(`${name} uploaded`),
  ready: (name) => toast.success(`${name} is ready — you can ask questions now`),
};

export default notify;
