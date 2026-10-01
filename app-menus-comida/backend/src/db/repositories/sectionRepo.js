// Data access for supermarkets and their sections.
import { db } from '../connection.js';

/** The supermarket chosen in the profile (Mercadona for now). */
export function getDefaultSupermarketId() {
  return db.prepare('SELECT default_supermarket_id AS id FROM profile WHERE id = 1').get().id;
}

/** Sections of a supermarket in walking order. */
export function listSections(supermarketId = getDefaultSupermarketId()) {
  return db
    .prepare('SELECT id, name, position FROM sections WHERE supermarket_id = ? ORDER BY position')
    .all(supermarketId);
}

export function findSectionByName(name, supermarketId = getDefaultSupermarketId()) {
  return db.prepare('SELECT id, name, position FROM sections WHERE supermarket_id = ? AND name = ?').get(supermarketId, name) ?? null;
}

export function sectionExists(sectionId, supermarketId = getDefaultSupermarketId()) {
  return Boolean(db.prepare('SELECT 1 FROM sections WHERE id = ? AND supermarket_id = ?').get(sectionId, supermarketId));
}
