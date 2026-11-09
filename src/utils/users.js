/**
 * Create-user and reset-password answer with the user plus `emailSent`
 * (whether the login details reached the user's inbox). The contract says
 * "user + emailSent", so this accepts the flag alongside the user's fields or
 * wrapping a nested `user`, and keeps the flag out of the stored user.
 *
 * `emailSent` is `true`, `false`, or `null` when the backend did not say —
 * which is treated like `false`: the password is shown so it is never lost.
 */
export const splitEmailResult = (payload) => {
  if (!payload || typeof payload !== 'object') return { user: null, emailSent: null };
  const { emailSent = null, user: nested, ...rest } = payload;
  return { user: nested ?? rest, emailSent: typeof emailSent === 'boolean' ? emailSent : null };
};

/** Where a user signs in — included in the details an admin passes on by hand. */
export const signInUrl = () =>
  (typeof window === 'undefined' ? '/login' : `${window.location.origin}/login`);
