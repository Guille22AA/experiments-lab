// Data access for recipes, their ingredients, the cooked history and the feedback.
import { db } from '../connection.js';
import { nowIso, parseJson, toJson } from '../../lib/json.js';

function rowToRecipe(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    steps: parseJson(row.steps, []),
    timeMinutes: row.time_minutes,
    difficulty: row.difficulty,
    servings: row.servings,
    equipment: parseJson(row.equipment, []),
    tags: parseJson(row.tags, []),
    source: row.source,
    sourceUrl: row.source_url,
    isFavorite: Boolean(row.is_favorite),
    status: row.status,
    parentRecipeId: row.parent_recipe_id,
    linkedProductId: row.linked_product_id,
    createdAt: row.created_at,
  };
}

/** Recipe fields as named SQL parameters. */
function toParams(recipe) {
  return {
    name: recipe.name,
    description: recipe.description ?? null,
    steps: toJson(recipe.steps ?? []),
    timeMinutes: recipe.timeMinutes ?? null,
    difficulty: recipe.difficulty ?? null,
    servings: recipe.servings ?? null,
    equipment: toJson(recipe.equipment ?? []),
    tags: toJson(recipe.tags ?? []),
    source: recipe.source,
    sourceUrl: recipe.sourceUrl ?? null,
    isFavorite: recipe.isFavorite ? 1 : 0,
    status: recipe.status ?? 'saved',
    parentRecipeId: recipe.parentRecipeId ?? null,
    linkedProductId: recipe.linkedProductId ?? null,
    now: nowIso(),
  };
}

function insertIngredients(recipeId, ingredients = []) {
  const insert = db.prepare(
    'INSERT INTO recipe_ingredients (recipe_id, product_id, name, quantity_text, optional) VALUES (?, ?, ?, ?, ?)',
  );
  for (const ingredient of ingredients) {
    insert.run(recipeId, ingredient.productId ?? null, ingredient.name, ingredient.quantityText ?? null, ingredient.optional ? 1 : 0);
  }
}

/**
 * @param {{ name, description?, steps?, timeMinutes?, difficulty?, servings?, equipment?, tags?,
 *           source, sourceUrl?, isFavorite?, status?, parentRecipeId?, linkedProductId?,
 *           ingredients: { name, quantityText?, optional?, productId? }[] }} recipe
 * @returns {number} new recipe id
 */
export function createRecipe(recipe) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO recipes (name, description, steps, time_minutes, difficulty, servings, equipment, tags,
                source, source_url, is_favorite, status, parent_recipe_id, linked_product_id, created_at, updated_at)
              VALUES (@name, @description, @steps, @timeMinutes, @difficulty, @servings, @equipment, @tags,
                @source, @sourceUrl, @isFavorite, @status, @parentRecipeId, @linkedProductId, @now, @now)`)
    .run(toParams(recipe));
  insertIngredients(lastInsertRowid, recipe.ingredients);
  return Number(lastInsertRowid);
}

/** Replaces the editable fields and the ingredient list (source and status do not change). */
export function updateRecipe(id, recipe) {
  db.prepare(`UPDATE recipes SET name = @name, description = @description, steps = @steps, time_minutes = @timeMinutes,
                difficulty = @difficulty, servings = @servings, equipment = @equipment, tags = @tags,
                source_url = @sourceUrl, is_favorite = @isFavorite, parent_recipe_id = @parentRecipeId,
                linked_product_id = @linkedProductId, updated_at = @now
              WHERE id = @id`).run({ ...toParams(recipe), id });
  db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
  insertIngredients(id, recipe.ingredients);
}

export function deleteRecipe(id) {
  db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
}

export function setFavorite(id, isFavorite) {
  db.prepare('UPDATE recipes SET is_favorite = ?, updated_at = ? WHERE id = ?').run(isFavorite ? 1 : 0, nowIso(), id);
}

export function listIngredients(recipeId) {
  return db
    .prepare('SELECT id, product_id AS productId, name, quantity_text AS quantityText, optional FROM recipe_ingredients WHERE recipe_id = ? ORDER BY id')
    .all(recipeId)
    .map((row) => ({ ...row, optional: Boolean(row.optional) }));
}

/** Full recipe with ingredients, or null. */
export function getRecipe(id) {
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  return row ? { ...rowToRecipe(row), ingredients: listIngredients(id) } : null;
}

/**
 * Light list of saved recipes: how many times each one was cooked, its latest
 * feedback, its base recipe (variations) and the product it is linked to.
 */
export function listRecipeSummaries({ includeSuggested = false } = {}) {
  return db
    .prepare(`SELECT r.id, r.name, r.time_minutes AS timeMinutes, r.tags, r.is_favorite AS isFavorite,
                     r.parent_recipe_id AS parentRecipeId, parent.name AS parentName,
                     r.linked_product_id AS linkedProductId, p.name AS linkedProductName,
                     (SELECT COUNT(*) FROM cooked_log c WHERE c.recipe_id = r.id) AS timesCooked,
                     (SELECT MAX(c.cooked_at) FROM cooked_log c WHERE c.recipe_id = r.id) AS lastCookedAt,
                     (SELECT f.verdict FROM recipe_feedback f WHERE f.recipe_id = r.id ORDER BY f.id DESC LIMIT 1) AS lastVerdict,
                     (SELECT f.adjustments FROM recipe_feedback f WHERE f.recipe_id = r.id ORDER BY f.id DESC LIMIT 1) AS lastAdjustments
              FROM recipes r
              LEFT JOIN recipes parent ON parent.id = r.parent_recipe_id
              LEFT JOIN products p ON p.id = r.linked_product_id
              WHERE r.status = 'saved' OR @includeSuggested
              ORDER BY r.name COLLATE NOCASE`)
    .all({ includeSuggested: includeSuggested ? 1 : 0 })
    .map((row) => ({
      ...row,
      tags: parseJson(row.tags, []),
      isFavorite: Boolean(row.isFavorite),
      lastAdjustments: parseJson(row.lastAdjustments, []),
    }));
}

/** Recipes that are variations of this one. */
export function listVariations(recipeId) {
  return db.prepare(`SELECT id, name FROM recipes WHERE parent_recipe_id = ? AND status = 'saved' ORDER BY name`).all(recipeId);
}

/** A recipe proposed by the AI becomes part of the recipe book once it is used. */
export function markRecipeSaved(id) {
  db.prepare(`UPDATE recipes SET status = 'saved', updated_at = ? WHERE id = ? AND status = 'suggested'`).run(nowIso(), id);
}

/** Removes AI suggestions that no menu uses any more (discarded menus or replaced dishes). */
export function deleteOrphanSuggestedRecipes() {
  db.prepare(`DELETE FROM recipes WHERE status = 'suggested'
              AND id NOT IN (SELECT recipe_id FROM menu_slots WHERE recipe_id IS NOT NULL)`).run();
}

export function recipeExists(id) {
  return Boolean(db.prepare('SELECT 1 FROM recipes WHERE id = ?').get(id));
}

// ---------- Cooked history and feedback ----------

/** Dates the recipe was cooked, newest first. */
export function listCookedDates(recipeId) {
  return db.prepare('SELECT id, cooked_at AS cookedAt, menu_slot_id AS menuSlotId FROM cooked_log WHERE recipe_id = ? ORDER BY cooked_at DESC').all(recipeId);
}

export function countCooked(recipeId) {
  return db.prepare('SELECT COUNT(*) AS n FROM cooked_log WHERE recipe_id = ?').get(recipeId).n;
}

export function addFeedback({ recipeId, cookedLogId = null, verdict, adjustments = [], note = null, isFirstTime }) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO recipe_feedback (recipe_id, cooked_log_id, verdict, adjustments, note, is_first_time, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(recipeId, cookedLogId, verdict, toJson(adjustments), note, isFirstTime ? 1 : 0, nowIso());
  return Number(lastInsertRowid);
}

export function listFeedback(recipeId) {
  return db
    .prepare(`SELECT id, verdict, adjustments, note, is_first_time AS isFirstTime, created_at AS createdAt
              FROM recipe_feedback WHERE recipe_id = ? ORDER BY id DESC`)
    .all(recipeId)
    .map((row) => ({ ...row, adjustments: parseJson(row.adjustments, []), isFirstTime: Boolean(row.isFirstTime) }));
}
