// Data access for menus, their slots (one dish at one meal of one day) and the cooked log.
import { db } from '../connection.js';
import { nowIso, parseJson, toJson } from '../../lib/json.js';

// ---------- Menus ----------

function rowToMenu(row) {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    startDate: row.start_date,
    days: row.days,
    status: row.status,
    shoppingSuggestions: parseJson(row.shopping_suggestions, []),
    createdAt: row.created_at,
  };
}

export function createMenu({ cycleId, startDate, days, status, shoppingSuggestions = [] }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO menus (cycle_id, start_date, days, status, shopping_suggestions, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(cycleId, startDate, days, status, toJson(shoppingSuggestions), nowIso());
  return Number(lastInsertRowid);
}

export function getMenu(id) {
  const row = db.prepare('SELECT * FROM menus WHERE id = ?').get(id);
  return row ? rowToMenu(row) : null;
}

/** Latest menu with one of the given statuses (e.g. the active one, or a draft). */
export function getLatestMenu(statuses) {
  const placeholders = statuses.map(() => '?').join(', ');
  const row = db.prepare(`SELECT * FROM menus WHERE status IN (${placeholders}) ORDER BY id DESC LIMIT 1`).get(...statuses);
  return row ? rowToMenu(row) : null;
}

export function setMenuStatus(id, status) {
  db.prepare('UPDATE menus SET status = ? WHERE id = ?').run(status, id);
}

export function updateMenuSpan(id, { days, shoppingSuggestions }) {
  db.prepare('UPDATE menus SET days = ?, shopping_suggestions = ? WHERE id = ?').run(days, toJson(shoppingSuggestions), id);
}

/** Only one active menu at a time: the previous one goes to history. */
export function archiveActiveMenus() {
  db.prepare(`UPDATE menus SET status = 'archived' WHERE status = 'active'`).run();
}

export function deleteMenu(id) {
  db.prepare('DELETE FROM menus WHERE id = ?').run(id);
}

/** Dish names of the last menus (to avoid repeating them). */
export function listRecentDishNames(menuCount) {
  return db
    .prepare(`SELECT DISTINCT COALESCE(r.name, s.title) AS name
              FROM menu_slots s LEFT JOIN recipes r ON r.id = s.recipe_id
              WHERE s.menu_id IN (SELECT id FROM menus WHERE status IN ('active', 'archived') ORDER BY id DESC LIMIT ?)`)
    .all(menuCount)
    .map((row) => row.name)
    .filter(Boolean);
}

// ---------- Slots ----------

const SELECT_SLOT = `
  SELECT s.*, r.name AS recipe_name, r.time_minutes, r.tags AS recipe_tags, r.description AS recipe_description
  FROM menu_slots s LEFT JOIN recipes r ON r.id = s.recipe_id`;

function rowToSlot(row) {
  return {
    id: row.id,
    menuId: row.menu_id,
    date: row.date,
    mealType: row.meal_type,
    recipeId: row.recipe_id,
    title: row.recipe_name ?? row.title,
    description: row.recipe_description ?? null,
    timeMinutes: row.time_minutes ?? null,
    tags: parseJson(row.recipe_tags, []),
    status: row.status,
    isLeftover: Boolean(row.is_leftover),
    leftoverOfSlotId: row.leftover_of_slot_id,
    batchGroup: row.batch_group,
    notes: row.notes,
  };
}

export function addSlot({ menuId, date, mealType, recipeId = null, title = null, isLeftover = false, leftoverOfSlotId = null, batchGroup = null, notes = null }) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO menu_slots (menu_id, date, meal_type, recipe_id, title, is_leftover, leftover_of_slot_id, batch_group, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(menuId, date, mealType, recipeId, title, isLeftover ? 1 : 0, leftoverOfSlotId, batchGroup, notes);
  return Number(lastInsertRowid);
}

export function listSlots(menuId) {
  return db.prepare(`${SELECT_SLOT} WHERE s.menu_id = ? ORDER BY s.date, s.id`).all(menuId).map(rowToSlot);
}

export function getSlot(id) {
  const row = db.prepare(`${SELECT_SLOT} WHERE s.id = ?`).get(id);
  return row ? rowToSlot(row) : null;
}

export function getSlotAt(menuId, date, mealType) {
  const row = db.prepare(`${SELECT_SLOT} WHERE s.menu_id = ? AND s.date = ? AND s.meal_type = ?`).get(menuId, date, mealType);
  return row ? rowToSlot(row) : null;
}

/** Updates the given fields of a slot (only these columns can change). */
export function updateSlot(id, fields) {
  const columns = {
    date: 'date',
    mealType: 'meal_type',
    recipeId: 'recipe_id',
    title: 'title',
    status: 'status',
    isLeftover: 'is_leftover',
    leftoverOfSlotId: 'leftover_of_slot_id',
    batchGroup: 'batch_group',
  };
  for (const [key, value] of Object.entries(fields)) {
    if (!columns[key]) throw new Error(`Unknown slot field ${key}`);
    const stored = typeof value === 'boolean' ? (value ? 1 : 0) : value;
    db.prepare(`UPDATE menu_slots SET ${columns[key]} = ? WHERE id = ?`).run(stored, id);
  }
  return getSlot(id);
}

/** Removes the still-planned slots from a date on (used to re-plan the rest of the menu). */
export function deletePlannedSlotsFrom(menuId, fromDate) {
  db.prepare(`DELETE FROM menu_slots WHERE menu_id = ? AND date >= ? AND status = 'planned'`).run(menuId, fromDate);
}

// ---------- Cooked log ----------

export function logCooked({ recipeId = null, title, menuSlotId = null, cookedAt = nowIso() }) {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO cooked_log (recipe_id, title, menu_slot_id, cooked_at) VALUES (?, ?, ?, ?)')
    .run(recipeId, title, menuSlotId, cookedAt);
  return Number(lastInsertRowid);
}

/** Undo "cooked" on a slot. */
export function deleteCookedForSlot(menuSlotId) {
  db.prepare('DELETE FROM cooked_log WHERE menu_slot_id = ?').run(menuSlotId);
}
