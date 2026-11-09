// No 0/O, 1/l/I: a temporary password is read aloud or retyped from a message.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * A random temporary password for a new or reset account. Uses the browser's
 * CSPRNG; rejection sampling keeps every character equally likely.
 */
export const generateTemporaryPassword = (length = 14) => {
  const out = [];
  const limit = 256 - (256 % ALPHABET.length);
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < limit && out.length < length) out.push(ALPHABET[byte % ALPHABET.length]);
    }
  }
  return out.join('');
};
