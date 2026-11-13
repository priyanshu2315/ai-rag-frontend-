const MAX = 60;

/** The placeholder a chat shows until it is titled. */
export const isDefaultChatTitle = (title) => !title || !String(title).trim() || String(title).trim().toLowerCase() === 'new conversation';

/** A chat's title from its first question: one line, cut at a word when long. */
export const chatTitleFromQuestion = (question) => {
  const text = String(question ?? '').replace(/\s+/g, ' ').trim();
  if (text.length <= MAX) return text;
  const cut = text.slice(0, MAX);
  const space = cut.lastIndexOf(' ');
  return `${(space > MAX / 2 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
};
