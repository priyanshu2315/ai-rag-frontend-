import { useMatch } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

/**
 * The document the user is currently on, or null for the global "all
 * documents" view — read from the URL, which is the only place it is stored.
 *
 * `useMatch` rather than `useParams` on purpose: this is called from the shell
 * as well as from the page, and a layout route's `useParams` cannot see the
 * params of the child route matched beneath it.
 *
 * Both document routes count: the chunk explorer is the same document seen a
 * different way, so the sidebar keeps it selected there too.
 */
export const useActiveDocumentId = () => {
  const chat = useMatch(ROUTES.DOCUMENT);
  const chunks = useMatch(ROUTES.CHUNKS);

  return chat?.params.documentId ?? chunks?.params.documentId ?? null;
};

export default useActiveDocumentId;
