// Data access for purchases and shopping cycles.
import { db } from '../connection.js';

// ---------- Purchases ----------

export function createPurchase({ cycleId, kind, purchasedAt, source, totalPrice = null }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO purchases (cycle_id, kind, purchased_at, source, total_price) VALUES (?, ?, ?, ?, ?)')
    .run(cycleId, kind, purchasedAt, source, totalPrice);
  return lastInsertRowid;
}

export function addPurchaseItem({ purchaseId, productId, rawText = null, quantityText = null, price = null }) {
  db.prepare('INSERT INTO purchase_items (purchase_id, product_id, raw_text, quantity_text, price) VALUES (?, ?, ?, ?, ?)')
    .run(purchaseId, productId, rawText, quantityText, price);
}

/** Latest purchases with their number of products. */
export function listPurchases(limit = 20) {
  return db
    .prepare(`SELECT p.id, p.kind, p.purchased_at AS purchasedAt, p.source, p.total_price AS totalPrice,
                     p.cycle_id AS cycleId, COUNT(pi.id) AS itemCount
              FROM purchases p LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
              GROUP BY p.id ORDER BY p.purchased_at DESC, p.id DESC LIMIT ?`)
    .all(limit);
}

/** Dates of the latest normal ("main") purchases, newest first. Used to learn the shopping rhythm. */
export function listMainPurchaseDates(limit) {
  return db
    .prepare(`SELECT purchased_at FROM purchases WHERE kind = 'main' ORDER BY purchased_at DESC LIMIT ?`)
    .all(limit)
    .map((row) => row.purchased_at);
}

// ---------- Shopping cycles ----------

const SELECT_CYCLE = `SELECT id, started_at AS startedAt, planned_days AS plannedDays, ended_at AS endedAt,
                             opening_purchase_id AS openingPurchaseId FROM shopping_cycles`;

/** The open cycle (not ended yet), or null. */
export function getCurrentCycle() {
  return db.prepare(`${SELECT_CYCLE} WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1`).get() ?? null;
}

export function closeCycle(id, endedAt) {
  db.prepare('UPDATE shopping_cycles SET ended_at = ? WHERE id = ?').run(endedAt, id);
}

export function createCycle({ startedAt, plannedDays }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO shopping_cycles (started_at, planned_days) VALUES (?, ?)')
    .run(startedAt, plannedDays);
  return lastInsertRowid;
}

export function setCycleOpeningPurchase(cycleId, purchaseId) {
  db.prepare('UPDATE shopping_cycles SET opening_purchase_id = ? WHERE id = ?').run(purchaseId, cycleId);
}

export function setCyclePlannedDays(cycleId, plannedDays) {
  db.prepare('UPDATE shopping_cycles SET planned_days = ? WHERE id = ?').run(plannedDays, cycleId);
}
