// Data access for the pantry (what is at home, with an approximate level).
import { db } from '../connection.js';
import { nowIso, parseJson } from '../../lib/json.js';
import { getDefaultSupermarketId } from './sectionRepo.js';

const SELECT_ITEM = `
  SELECT pi.id, pi.product_id, pi.level, pi.added_at, pi.updated_at,
         p.name, p.tags, p.approx_price, p.off_barcode, s.id AS section_id, s.name AS section_name, s.position AS section_position
  FROM pantry_items pi
  JOIN products p ON p.id = pi.product_id
  LEFT JOIN product_sections ps ON ps.product_id = p.id AND ps.supermarket_id = @supermarketId
  LEFT JOIN sections s ON s.id = ps.section_id`;

function rowToItem(row) {
  return {
    id: row.id,
    productId: row.product_id,
    name: row.name,
    tags: parseJson(row.tags, []),
    approxPrice: row.approx_price ?? null,
    offBarcode: row.off_barcode ?? null,
    level: row.level,
    sectionId: row.section_id ?? null,
    sectionName: row.section_name ?? null,
    addedAt: row.added_at,
    updatedAt: row.updated_at,
  };
}

/** Whole pantry ordered by section (walking order) and name. Items without section go last. */
export function listPantry(supermarketId = getDefaultSupermarketId()) {
  return db
    .prepare(`${SELECT_ITEM} ORDER BY s.position IS NULL, s.position, p.name COLLATE NOCASE`)
    .all({ supermarketId })
    .map(rowToItem);
}

export function getPantryItem(id, supermarketId = getDefaultSupermarketId()) {
  const row = db.prepare(`${SELECT_ITEM} WHERE pi.id = @id`).get({ id, supermarketId });
  return row ? rowToItem(row) : null;
}

export function getPantryItemByProduct(productId, supermarketId = getDefaultSupermarketId()) {
  const row = db.prepare(`${SELECT_ITEM} WHERE pi.product_id = @productId`).get({ productId, supermarketId });
  return row ? rowToItem(row) : null;
}

/** Sets the level of a product, adding it to the pantry if it was not there. */
export function setPantryLevel(productId, level) {
  const now = nowIso();
  db.prepare(`INSERT INTO pantry_items (product_id, level, added_at, updated_at) VALUES (?, ?, ?, ?)
              ON CONFLICT (product_id) DO UPDATE SET level = excluded.level, updated_at = excluded.updated_at`)
    .run(productId, level, now, now);
  return getPantryItemByProduct(productId);
}

export function updatePantryItemLevel(id, level) {
  db.prepare('UPDATE pantry_items SET level = ?, updated_at = ? WHERE id = ?').run(level, nowIso(), id);
  return getPantryItem(id);
}

export function deletePantryItemByProduct(productId) {
  db.prepare('DELETE FROM pantry_items WHERE product_id = ?').run(productId);
}

export function deletePantryItem(id) {
  return db.prepare('DELETE FROM pantry_items WHERE id = ?').run(id).changes > 0;
}

/** Puts back a deleted item exactly as it was (used by "Deshacer"). */
export function restorePantryItem({ productId, level, addedAt }) {
  db.prepare(`INSERT INTO pantry_items (product_id, level, added_at, updated_at) VALUES (?, ?, ?, ?)
              ON CONFLICT (product_id) DO UPDATE SET level = excluded.level`)
    .run(productId, level, addedAt, nowIso());
  return getPantryItemByProduct(productId);
}
