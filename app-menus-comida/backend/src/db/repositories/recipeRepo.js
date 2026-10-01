// Data access for recipes and their ingredients.
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

/**
 * @param {{ name, description?, steps?, timeMinutes?, difficulty?, servings?, equipment?, tags?,
 *           source, sourceUrl?, status?, parentRecipeId?, linkedProductId?,
 *           ingredients: { name, quantityText?, optional?, productId? }[] }} recipe
 * @returns {number} new recipe id
 */
export function createRecipe(recipe) {
  const now = nowIso();
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO recipes (name, description, steps, time_minutes, difficulty, servings, equipment, tags,
                source, source_url, status, parent_recipe_id, linked_product_id, created_at, updated_at)
              VALUES (@name, @description, @steps, @timeMinutes, @difficulty, @servings, @equipment, @tags,
                @source, @sourceUrl, @status, @parentRecipeId, @linkedProductId, @now, @now)`)
    .run({
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
      status: recipe.status ?? 'saved',
      parentRecipeId: recipe.parentRecipeId ?? null,
      linkedProductId: recipe.linkedProductId ?? null,
      now,
    });

  const insertIngredient = db.prepare(
    'INSERT INTO recipe_ingredients (recipe_id, product_id, name, quantity_text, optional) VALUES (?, ?, ?, ?, ?)',
  );
  for (const ingredient of recipe.ingredients ?? []) {
    insertIngredient.run(lastInsertRowid, ingredient.productId ?? null, ingredient.name, ingredient.quantityText ?? null, ingredient.optional ? 1 : 0);
  }
  return Number(lastInsertRowid);
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
 * Light list of saved recipes (for the AI context and the "pick from recipes" option):
 * how many times each one was cooked and, if any, the product it is linked to.
 */
export function listRecipeSummaries({ includeSuggested = false } = {}) {
  return db
    .prepare(`SELECT r.id, r.name, r.time_minutes AS timeMinutes, r.tags, r.is_favorite AS isFavorite,
                     r.linked_product_id AS linkedProductId, p.name AS linkedProductName,
                     COUNT(c.id) AS timesCooked, MAX(c.cooked_at) AS lastCookedAt
              FROM recipes r
              LEFT JOIN products p ON p.id = r.linked_product_id
              LEFT JOIN cooked_log c ON c.recipe_id = r.id
              WHERE r.status = 'saved' OR @includeSuggested
              GROUP BY r.id
              ORDER BY r.name COLLATE NOCASE`)
    .all({ includeSuggested: includeSuggested ? 1 : 0 })
    .map((row) => ({ ...row, tags: parseJson(row.tags, []), isFavorite: Boolean(row.isFavorite) }));
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
