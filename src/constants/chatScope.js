/**
 * Which global chats the Chats list shows. Only admins ever see ALL — every
 * user's chats, read-only unless their own — and only they get the toggle.
 * It is the Chats page's `?scope=` value too.
 */
export const CHAT_SCOPE = {
  MINE: 'mine',
  ALL: 'all',
};
