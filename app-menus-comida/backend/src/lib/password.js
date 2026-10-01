// Password hashing with scrypt (built into Node, no extra dependency).
// Stored format: "scrypt$<N>$<salt base64>$<hash base64>", so the cost can be
// raised in the future without breaking existing passwords.
import crypto from 'node:crypto';

const COST = 16384; // scrypt N: slow enough to make guessing expensive
const KEY_LENGTH = 64;

const scrypt = (password, salt, cost) =>
  new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, KEY_LENGTH, { N: cost, maxmem: 64 * 1024 * 1024 }, (error, key) => (error ? reject(error) : resolve(key))),
  );

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, COST);
  return `scrypt$${COST}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [algorithm, cost, salt, hash] = String(stored).split('$');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), Number(cost));
  // Constant-time comparison: does not leak how many characters matched.
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Random session token for the cookie, and the hash stored in the database. */
export function newSessionToken() {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
