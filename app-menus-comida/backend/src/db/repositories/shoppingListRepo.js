// Data access for the shopping list.
// The section of an item comes from its product (in the current supermarket),
// or from the item itself for free-text items without product.
import { db } from '../connection.js';
import { nowIso } from '../../lib/json.js';
import { getDefaultSupermarketId } from './sectionRepo.js';

const SELECT_ITEM = `
  SELECT i.*, COALESCE(ps.section_id, i.section_id) AS effective_section_id, p.approx_price
  FROM shopping_list_items i
  LEFT JOIN products p ON p.id = i.product_id
  LEFT JOIN product_sections ps ON ps.product_id = i.product_id AND ps.supermarket_id = @supermarketId`;

function rowToItem(row) {
  return {
    id: row.id,
    productId: row.product_id,
    text: row.text,
    quantityText: row.quantity_text,
    sectionId: row.effective_section_id ?? null,
    checked: Boolean(row.checked),
    checkedAt: row.checked_at,
    source: row.source,
    menuId: row.menu_id,
    createdAt: row.created_at,
    approxPrice: row.approx_price ?? null,
  };
}

export function listItems(supermarketId = getDefaultSupermarketId()) {
  return db.prepare(`${SELECT_ITEM} ORDER BY i.created_at, i.id`).all({ supermarketId }).map(rowToItem);
}

export function getItem(id, supermarketId = getDefaultSupermarketId()) {
  const row = db.prepare(`${SELECT_ITEM} WHERE i.id = @id`).get({ id, supermarketId });
  return row ? rowToItem(row) : null;
}

/** The item still to buy (not ticked) for a product, if there is one. */
export function findPendingItemByProduct(productId, supermarketId = getDefaultSupermarketId()) {
  const row = db.prepare(`${SELECT_ITEM} WHERE i.product_id = @productId AND i.checked = 0`).get({ productId, supermarketId });
  return row ? rowToItem(row) : null;
}

export function createItem({ productId = null, text, quantityText = null, sectionId = null, source, menuId = null, createdAt = nowIso() }) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO shopping_list_items (product_id, text, quantity_text, section_id, source, menu_id, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(productId, text, quantityText, sectionId, source, menuId, createdAt, nowIso());
  return getItem(Number(lastInsertRowid));
}

export function updateItem(id, { checked, quantityText, text }) {
  const now = nowIso();
  if (checked !== undefined) {
    db.prepare('UPDATE shopping_list_items SET checked = ?, checked_at = ?, updated_at = ? WHERE id = ?')
      .run(checked ? 1 : 0, checked ? now : null, now, id);
  }
  if (quantityText !== undefined) {
    db.prepare('UPDATE shopping_list_items SET quantity_text = ?, updated_at = ? WHERE id = ?').run(quantityText || null, now, id);
  }
  if (text !== undefined) {
    db.prepare('UPDATE shopping_list_items SET text = ?, updated_at = ? WHERE id = ?').run(text, now, id);
  }
  return getItem(id);
}

export function deleteItem(id) {
  db.prepare('DELETE FROM shopping_list_items WHERE id = ?').run(id);
}

export function deleteCheckedItems() {
  return db.prepare('DELETE FROM shopping_list_items WHERE checked = 1').run().changes;
}

/** After a purchase: whatever was bought leaves the list (ticked or not). */
export function deleteItemsForProducts(productIds) {
  const remove = db.prepare('DELETE FROM shopping_list_items WHERE product_id = ?');
  let removed = 0;
  for (const id of productIds) removed += remove.run(id).changes;
  return removed;
}
