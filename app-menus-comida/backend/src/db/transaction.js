import { db } from './connection.js';

/**
 * Runs `fn` inside a database transaction: either everything is saved or nothing.
 * Lets the domain layer group several repository calls without touching SQL.
 */
export function runInTransaction(fn) {
  return db.transaction(fn)();
}
