import { useMatch } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

/**
 * The global chat the user is on, or null — read from the URL, the only
 * place it is stored. `useMatch` (not `useParams`) so the shell can call it.
 */
export const useActiveChatId = () => useMatch(ROUTES.CHAT_CONVERSATION)?.params.chatId ?? null;

export default useActiveChatId;
