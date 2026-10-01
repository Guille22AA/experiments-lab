// The recipe book ("memoria de cocina"): saving, details, cooking and feedback (no AI here).
import { z } from 'zod';
import { logCooked } from '../db/repositories/menuRepo.js';
import { getPantryItemByProduct } from '../db/repositories/pantryRepo.js';
import { findProductByName, getProduct, searchProducts } from '../db/repositories/productRepo.js';
import { getProfile } from '../db/repositories/profileRepo.js';
import {
  addFeedback,
  countCooked,
  createRecipe,
  getRecipe,
  listCookedDates,
  listFeedback,
  listVariations,
  markRecipeSaved,
  updateRecipe,
} from '../db/repositories/recipeRepo.js';
import { runInTransaction } from '../db/transaction.js';
import { HttpError } from '../lib/errors.js';
import { proposePantryDeduction } from './menus.js';
import { resolveProduct } from './products.js';
import { checkIngredients } from './restrictionCheck.js';

// Quick feedback options after cooking (no stars, on purpose).
export const VERDICTS = ['loved', 'too_slow', 'disliked', 'adjust'];
export const ADJUSTMENTS = ['faster', 'simpler', 'less_spicy', 'more_spicy', 'lighter', 'bigger'];

const DIFFICULTIES = ['easy', 'medium', 'hard'];

/** A recipe as written in the form (or reviewed after an import). */
export const recipeInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  timeMinutes: z.number().int().min(1).max(1440).nullish(),
  difficulty: z.enum(DIFFICULTIES).nullish(),
  servings: z.number().int().min(1).max(50).nullish(),
  equipment: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantityText: z.string().trim().max(60).nullish(),
        optional: z.boolean().default(false),
      }),
    )
    .min(1, 'La receta necesita al menos un ingrediente.')
    .max(60),
  steps: z.array(z.string().trim().min(1).max(1000)).max(40).default([]),
  source: z.enum(['user', 'chat', 'link', 'ai']).default('user'),
  sourceUrl: z.url().max(500).nullish(),
  isFavorite: z.boolean().default(false),
  parentRecipeId: z.number().int().positive().nullish(), // this recipe is a variation of...
  linkedProductName: z.string().trim().max(120).nullish(), // "yatekomos" → this recipe
});

/** Checks the base recipe of a variation: it must exist and must not create a loop. */
function validateParent(parentRecipeId, recipeId) {
  if (!parentRecipeId) return null;
  if (parentRecipeId === recipeId) throw new HttpError(400, 'Una receta no puede ser variación de sí misma.');
  const parent = getRecipe(parentRecipeId);
  if (!parent) throw new HttpError(400, 'La receta base ya no existe.');
  if (recipeId && parent.parentRecipeId === recipeId) throw new HttpError(400, 'Esa receta ya es una variación de esta.');
  return parentRecipeId;
}

/**
 * Product a recipe is linked to. "Yatekomo" should find the known "Yatekomo pollo"
 * instead of creating a new product; only an unknown name creates one.
 */
function linkedProductIdFor(name) {
  if (!name) return null;
  const product = findProductByName(name) ?? searchProducts(name, 1)[0] ?? resolveProduct({ name });
  return product.id;
}

/** Creates (no id) or updates a recipe. Ingredients are linked to known products. */
export function saveRecipe(input, recipeId = null) {
  return runInTransaction(() => {
    const existing = recipeId ? getRecipe(recipeId) : null;
    if (recipeId && !existing) throw new HttpError(404, 'Esa receta no existe.');

    const recipe = {
      ...input,
      source: existing?.source ?? input.source,
      parentRecipeId: validateParent(input.parentRecipeId ?? null, recipeId),
      // The linked product is learned like any other product.
      linkedProductId: linkedProductIdFor(input.linkedProductName),
      ingredients: input.ingredients.map((i) => ({ ...i, productId: findProductByName(i.name)?.id ?? null })),
    };

    if (existing) {
      updateRecipe(recipeId, recipe);
      markRecipeSaved(recipeId); // editing an AI suggestion means keeping it
      return recipeId;
    }
    return createRecipe({ ...recipe, status: 'saved' });
  });
}

/** Everything the detail screen shows. */
export function getRecipeDetail(recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new HttpError(404, 'Esa receta no existe.');
  const parent = recipe.parentRecipeId ? getRecipe(recipe.parentRecipeId) : null;
  const linked = recipe.linkedProductId ? getProduct(recipe.linkedProductId) : null;
  return {
    ...recipe,
    check: checkIngredients(recipe.ingredients, getProfile().restrictions),
    parent: parent && { id: parent.id, name: parent.name },
    variations: listVariations(recipeId),
    linkedProduct: linked && { id: linked.id, name: linked.name, pantryLevel: getPantryItemByProduct(linked.id)?.level ?? null },
    cooked: listCookedDates(recipeId),
    feedback: listFeedback(recipeId),
  };
}

/** "Hoy me he hecho el ramen": cooked outside the menu. */
export function logCookedOutsideMenu(recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new HttpError(404, 'Esa receta no existe.');
  return runInTransaction(() => {
    const cookedLogId = logCooked({ recipeId, title: recipe.name });
    markRecipeSaved(recipeId);
    return { cookedLogId, recipeId, isFirstTime: countCooked(recipeId) === 1, deduction: proposePantryDeduction(recipeId) };
  });
}

const feedbackSchema = z.object({
  verdict: z.enum(VERDICTS),
  adjustments: z.array(z.enum(ADJUSTMENTS)).max(ADJUSTMENTS.length).default([]),
  note: z.string().trim().max(500).nullish(),
  cookedLogId: z.number().int().positive().nullish(),
});

export { feedbackSchema };

export function addRecipeFeedback(recipeId, { verdict, adjustments, note, cookedLogId }) {
  if (!getRecipe(recipeId)) throw new HttpError(404, 'Esa receta no existe.');
  if (verdict === 'adjust' && adjustments.length === 0) throw new HttpError(400, 'Dime qué ajustar.');
  markRecipeSaved(recipeId); // rating a recipe also keeps it
  // "First time" = cooked at most once so far (the time being rated).
  const isFirstTime = countCooked(recipeId) <= 1;
  addFeedback({ recipeId, cookedLogId, verdict, adjustments, note: note || null, isFirstTime });
  return { isFirstTime };
}
