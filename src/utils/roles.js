const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * The delete-role warning. Deleting a role takes its documents away from
 * every user who had it, so the number of affected users is spelled out.
 * Accepts a summary (`userCount`) or a full role (`users[]`).
 */
export const roleDeleteMessage = (role) => {
  const users = role.users?.length ?? role.userCount ?? 0;
  const documents = role.documents?.length ?? role.documentCount ?? 0;
  if (users === 0) return "No users have this role, so nobody loses access. This can't be undone.";
  return `${plural(users, 'user')} will lose access to this role's ${plural(documents, 'document')} `
    + "(unless another of their roles includes them). This can't be undone.";
};
