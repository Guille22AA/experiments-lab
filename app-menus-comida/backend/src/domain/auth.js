// Access to the app: one user, one password (it is a personal app).
// The first time, the app asks to create the password. Each device that logs
// in gets a long-lived session (90 days by default).
import { config } from '../config.js';
import {
  createSession,
  deleteExpiredSessions,
  deleteSession,
  deleteSessionsExcept,
  getPasswordHash,
  getValidSession,
  setPasswordHash,
  touchSession,
} from '../db/repositories/authRepo.js';
import { HttpError } from '../lib/errors.js';
import { hashPassword, hashToken, newSessionToken, verifyPassword } from '../lib/password.js';

export const MIN_PASSWORD_LENGTH = 8;

export const isPasswordSet = () => getPasswordHash() !== null;

function startSession(userAgent) {
  deleteExpiredSessions();
  const { token, tokenHash } = newSessionToken();
  const expiresAt = new Date(Date.now() + config.auth.sessionDays * 86_400_000).toISOString();
  createSession({ tokenHash, expiresAt, userAgent: userAgent?.slice(0, 200) ?? null });
  return { token, expiresAt };
}

/** First run: create the password and log this device in. */
export async function setupPassword(password, userAgent) {
  if (isPasswordSet()) throw new HttpError(409, 'Ya hay una contraseña. Inicia sesión.');
  setPasswordHash(await hashPassword(password));
  return startSession(userAgent);
}

export async function login(password, userAgent) {
  const stored = getPasswordHash();
  if (!stored) throw new HttpError(409, 'Todavía no hay contraseña: créala primero.');
  if (!(await verifyPassword(password, stored))) throw new HttpError(401, 'Contraseña incorrecta.');
  return startSession(userAgent);
}

/** True if the token belongs to a valid session. */
export function isValidSession(token) {
  if (!token) return false;
  const tokenHash = hashToken(token);
  if (!getValidSession(tokenHash)) return false;
  touchSession(tokenHash);
  return true;
}

export function logout(token) {
  if (token) deleteSession(hashToken(token));
}

/** Changes the password and logs out every OTHER device. */
export async function changePassword(currentToken, currentPassword, newPassword) {
  if (!(await verifyPassword(currentPassword, getPasswordHash()))) throw new HttpError(401, 'La contraseña actual no es correcta.');
  setPasswordHash(await hashPassword(newPassword));
  deleteSessionsExcept(hashToken(currentToken));
}
