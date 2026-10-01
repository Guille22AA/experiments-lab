// Data access for chat messages (both the onboarding interview and the normal chat).
import { db } from '../connection.js';
import { nowIso, parseJson, toJson } from '../../lib/json.js';

function rowToMessage(row) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    mode: row.mode,
    screenContext: parseJson(row.screen_context, null),
    data: parseJson(row.data, null),
    createdAt: row.created_at,
  };
}

export function addMessage({ role, content, mode, screenContext = null, data = null }) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO chat_messages (role, content, mode, screen_context, data, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(role, content, mode, screenContext ? toJson(screenContext) : null, data ? toJson(data) : null, nowIso());
  return getMessage(lastInsertRowid);
}

export function getMessage(id) {
  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id);
  return row ? rowToMessage(row) : null;
}

/** Last `limit` messages of a mode, oldest first. */
export function listRecentMessages(mode, limit) {
  const rows = db
    .prepare('SELECT * FROM chat_messages WHERE mode = ? ORDER BY id DESC LIMIT ?')
    .all(mode, limit);
  return rows.reverse().map(rowToMessage);
}

export function deleteMessages(mode) {
  db.prepare('DELETE FROM chat_messages WHERE mode = ?').run(mode);
}
