// Data access for the password and the logged-in devices (sessions).
import { db } from '../connection.js';
import { nowIso } from '../../lib/json.js';

export function getPasswordHash() {
  return db.prepare('SELECT password_hash FROM auth WHERE id = 1').get()?.password_hash ?? null;
}

export function setPasswordHash(passwordHash) {
  db.prepare(`INSERT INTO auth (id, password_hash, updated_at) VALUES (1, ?, ?)
              ON CONFLICT (id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`)
    .run(passwordHash, nowIso());
}

export function deletePassword() {
  db.prepare('DELETE FROM auth').run();
}

export function createSession({ tokenHash, expiresAt, userAgent }) {
  const now = nowIso();
  db.prepare('INSERT INTO sessions (token_hash, created_at, expires_at, last_seen_at, user_agent) VALUES (?, ?, ?, ?, ?)')
    .run(tokenHash, now, expiresAt, now, userAgent);
}

/** The session if it exists and has not expired. */
export function getValidSession(tokenHash) {
  return db.prepare('SELECT * FROM sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash, nowIso()) ?? null;
}

export function touchSession(tokenHash) {
  db.prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?').run(nowIso(), tokenHash);
}

export function deleteSession(tokenHash) {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

/** Logs out every device, except (optionally) the current one. */
export function deleteSessionsExcept(tokenHash = null) {
  db.prepare('DELETE FROM sessions WHERE token_hash IS NOT ?').run(tokenHash);
}

export function deleteExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso());
}
