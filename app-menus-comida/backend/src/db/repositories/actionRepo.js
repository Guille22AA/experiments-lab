// Data access for the actions proposed by the assistant (and what is needed to undo them).
import { db } from '../connection.js';
import { nowIso, parseJson, toJson } from '../../lib/json.js';

function rowToAction(row) {
  return {
    id: row.id,
    messageId: row.chat_message_id,
    type: row.type,
    payload: parseJson(row.payload, {}),
    summary: row.summary,
    warnings: parseJson(row.warnings, []),
    status: row.status,
    undoData: parseJson(row.undo_data, null),
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export function createAction({ messageId, type, payload, summary, warnings = [] }) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO assistant_actions (chat_message_id, type, payload, summary, warnings, created_at)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .run(messageId, type, toJson(payload), summary, toJson(warnings), nowIso());
  return getAction(Number(lastInsertRowid));
}

export function getAction(id) {
  const row = db.prepare('SELECT * FROM assistant_actions WHERE id = ?').get(id);
  return row ? rowToAction(row) : null;
}

/** proposed → accepted / rejected / failed / undone. */
export function setActionStatus(id, status, undoData) {
  db.prepare('UPDATE assistant_actions SET status = ?, undo_data = COALESCE(?, undo_data), resolved_at = ? WHERE id = ?')
    .run(status, undoData === undefined ? null : toJson(undoData), nowIso(), id);
  return getAction(id);
}

/** Actions of some chat messages (to show them under each message). */
export function listActionsForMessages(messageIds) {
  if (messageIds.length === 0) return [];
  const placeholders = messageIds.map(() => '?').join(', ');
  return db
    .prepare(`SELECT * FROM assistant_actions WHERE chat_message_id IN (${placeholders}) ORDER BY id`)
    .all(...messageIds)
    .map(rowToAction);
}

/** Applied (and undone) actions, newest first: the assistant's history. */
export function listActionHistory(limit = 50) {
  return db
    .prepare(`SELECT * FROM assistant_actions WHERE status IN ('accepted', 'undone') ORDER BY resolved_at DESC LIMIT ?`)
    .all(limit)
    .map(rowToAction);
}
