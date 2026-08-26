import { useEffect } from 'react';

const APP_NAME = 'DocuMind';

/** Sets the browser tab title for a page (§3.3) and restores nothing — the
 *  next page sets its own. */
export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME;
  }, [title]);
};

export default usePageTitle;
