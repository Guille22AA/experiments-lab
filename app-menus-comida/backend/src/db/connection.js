// Opens the SQLite database and makes sure the schema and seed data exist.
// To switch to another database in the future, replace this folder (db/):
// the rest of the app only talks to the repositories.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';
import { seed } from './seed.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL'); // better behaviour with concurrent reads
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(import.meta.dirname, 'schema.sql'), 'utf8');
db.exec(schema);
migrate();
seed(db);

/**
 * Changes to tables that already exist in someone's database.
 * CREATE TABLE IF NOT EXISTS does not add new columns, so they are added here.
 * Each step must be safe to run on every start.
 */
function migrate() {
  addColumnIfMissing('menus', 'shopping_suggestions', "TEXT NOT NULL DEFAULT '[]'");
}

function addColumnIfMissing(table, column, definition) {
  const exists = db.prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = ?`).get(table, column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
