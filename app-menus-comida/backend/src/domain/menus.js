// Menus of the shopping cycle: generation (AI) and management (code).
//
// Generation flow:
//   1. contextBuilder summarizes profile, pantry, recipes and recent dishes.
//   2. The AI proposes dishes + slots (validated with zod).
//   3. Code cleans the plan (dates, duplicates, unknown recipes).
//   4. Code checks every dish against the restrictions (HARD filter).
//      Dishes that break them are sent back to the AI once to be replaced.
//      If a replacement still breaks them, the dish stays but the menu shows a
//      very visible warning (it is recomputed every time the menu is shown).
import { generateJson } from '../ai/aiService.js';
import { buildAlternativesContext, buildMenuContext } from '../ai/contextBuilder.js';
import { dishListSchema, menuPlanSchema } from '../ai/schemas/menuSchema.js';
import {
  addSlot,
  archiveActiveMenus,
  createMenu,
  deleteCookedForSlot,
  deleteMenu,
  deletePlannedSlotsFrom,
  getLatestMenu,
  getMenu,
  getSlot,
  getSlotAt,
  listSlots,
  logCooked,
  setMenuStatus,
  updateMenuSpan,
  updateSlot,
} from '../db/repositories/menuRepo.js';
import { getPantryItemByProduct } from '../db/repositories/pantryRepo.js';
import { findProductByName } from '../db/repositories/productRepo.js';
import { getProfile } from '../db/repositories/profileRepo.js';
import { getCurrentCycle, setCyclePlannedDays } from '../db/repositories/purchaseRepo.js';
import { createRecipe, deleteOrphanSuggestedRecipes, getRecipe, markRecipeSaved } from '../db/repositories/recipeRepo.js';
import { runInTransaction } from '../db/transaction.js';
import { addDays, daysBetweenDays, listDays, todayLocal } from '../lib/dates.js';
import { HttpError } from '../lib/errors.js';
import { MEAL_TYPES } from './profile.js';
import { checkIngredients } from './restrictionCheck.js';

export const MAX_MENU_DAYS = 14;

/** Meals to plan, in the order of the day. */
const mealTypesToPlan = () => MEAL_TYPES.filter((m) => getProfile().mealsToPlan.includes(m));
const mealOrder = (mealType) => MEAL_TYPES.indexOf(mealType);

// ---------- Cleaning and checking the AI plan ----------

/**
 * Prepares one dish from the AI: links `existingRecipeId` to the real recipe, or
 * returns null if the dish is unusable (unknown recipe id and no recipe of its own).
 */
function prepareDish(dish) {
  if (dish.existingRecipeId) {
    const recipe = getRecipe(dish.existingRecipeId);
    if (recipe) return { ...dish, existingRecipe: recipe };
    if (dish.ingredients.length === 0 || dish.steps.length === 0) return null;
  }
  return { ...dish, existingRecipeId: null, existingRecipe: null };
}

/** Ingredients to check for a dish (saved recipe or AI proposal). */
function ingredientsOf(dish) {
  return dish.existingRecipe ? dish.existingRecipe.ingredients : dish.ingredients.map((i) => ({ name: i.name }));
}

/** Keeps only valid slots: known dish, planned day and meal, one dish per meal. */
function cleanPlan(plan, days, mealTypes) {
  const dishes = new Map();
  for (const raw of plan.dishes) {
    const dish = prepareDish(raw);
    if (dish) dishes.set(dish.key, dish);
  }

  const allowedDates = new Set(days.map((d) => d.date));
  const taken = new Set();
  const slots = [];
  for (const slot of plan.slots) {
    const id = `${slot.date}|${slot.mealType}`;
    if (!allowedDates.has(slot.date) || !mealTypes.includes(slot.mealType) || !dishes.has(slot.dishKey) || taken.has(id)) continue;
    taken.add(id);
    slots.push(slot);
  }
  if (slots.length === 0) throw new HttpError(502, 'La IA ha devuelto un menú vacío. Prueba otra vez.');
  return { dishes, slots, shoppingSuggestions: plan.shoppingSuggestions };
}

/** dishKey → violations, for the dishes that break a restriction. */
function findViolations(dishes, restrictions) {
  const violating = new Map();
  for (const [key, dish] of dishes) {
    const { violations } = checkIngredients(ingredientsOf(dish), restrictions);
    if (violations.length > 0) violating.set(key, violations);
  }
  return violating;
}

/** Asks the AI ONCE to replace the dishes that break restrictions (same keys). */
async function replaceViolatingDishes(context, plan, violating) {
  const problems = [...violating]
    .map(([key, violations]) => {
      const list = violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ');
      return `- "${key}" ${plan.dishes.get(key).name}: ${list}`;
    })
    .join('\n');

  const fix = await generateJson({
    system: context.system,
    messages: [
      ...context.messages,
      { role: 'assistant', content: JSON.stringify({ dishes: [...plan.dishes.values()].map((d) => ({ key: d.key, name: d.name })) }) },
      {
        role: 'user',
        content: `These dishes break the user's restrictions:\n${problems}\nReturn ONLY {"dishes": [...]} with one replacement for each, keeping the same "key" and avoiding those ingredients.`,
      },
    ],
    schema: dishListSchema,
  });

  for (const raw of fix.dishes) {
    const dish = violating.has(raw.key) ? prepareDish(raw) : null;
    if (dish) plan.dishes.set(raw.key, dish);
  }
}

/** Full AI round: plan, clean, check restrictions, fix once. */
async function planWithAi({ days, mealTypes, keptDishes = [] }) {
  const context = buildMenuContext({ days, mealTypes, keptDishes });
  const raw = await generateJson({ ...context, schema: menuPlanSchema });
  const plan = cleanPlan(raw, days, mealTypes);

  const restrictions = getProfile().restrictions;
  const violating = findViolations(plan.dishes, restrictions);
  if (violating.size > 0) {
    console.warn(`[menu] ${violating.size} dishes break restrictions, asking for replacements`);
    await replaceViolatingDishes(context, plan, violating);
  }
  return plan;
}

// ---------- Saving ----------

/** Saves an AI dish as a recipe (status "suggested" until it is cooked) and returns its id. */
function saveDish(dish) {
  if (dish.existingRecipe) return dish.existingRecipe.id;
  return createRecipe({
    name: dish.name,
    description: dish.description,
    steps: dish.steps,
    timeMinutes: dish.timeMinutes,
    difficulty: dish.difficulty,
    servings: dish.servings,
    equipment: dish.equipment,
    tags: dish.tags,
    source: 'ai',
    status: 'suggested',
    ingredients: dish.ingredients.map((i) => ({
      name: i.name,
      quantityText: i.quantity,
      optional: i.optional,
      productId: findProductByName(i.name)?.id ?? null, // link to the pantry when we know the product
    })),
  });
}

function insertSlots(menuId, plan) {
  const recipeIds = new Map(); // dishKey → recipe id
  const firstSlot = new Map(); // dishKey → slot id where it is cooked first
  const ordered = [...plan.slots].sort((a, b) => a.date.localeCompare(b.date) || mealOrder(a.mealType) - mealOrder(b.mealType));

  for (const slot of ordered) {
    const dish = plan.dishes.get(slot.dishKey);
    if (!recipeIds.has(slot.dishKey)) recipeIds.set(slot.dishKey, saveDish(dish));
    // Leftovers only make sense after the dish has been cooked once.
    const isLeftover = slot.isLeftover && firstSlot.has(slot.dishKey);
    const id = addSlot({
      menuId,
      date: slot.date,
      mealType: slot.mealType,
      recipeId: recipeIds.get(slot.dishKey),
      title: dish.name,
      isLeftover,
      leftoverOfSlotId: isLeftover ? firstSlot.get(slot.dishKey) : null,
      batchGroup: slot.batchGroup ?? null,
    });
    if (!firstSlot.has(slot.dishKey)) firstSlot.set(slot.dishKey, id);
  }
}

// ---------- Public operations ----------

export function getCurrentMenus() {
  return { active: getLatestMenu(['active']), draft: getLatestMenu(['draft']) };
}

/**
 * Generates a NEW menu as a draft (the user accepts it or asks for another one).
 * The active menu, if any, stays until the draft is accepted.
 */
export async function generateMenu({ days: dayCount, startDate = todayLocal() }) {
  const mealTypes = mealTypesToPlan();
  const days = listDays(startDate, dayCount);
  const plan = await planWithAi({ days, mealTypes });

  return runInTransaction(() => {
    const previousDraft = getLatestMenu(['draft']);
    if (previousDraft) deleteMenu(previousDraft.id);
    const menuId = createMenu({
      cycleId: getCurrentCycle()?.id ?? null,
      startDate,
      days: dayCount,
      status: 'draft',
      shoppingSuggestions: plan.shoppingSuggestions,
    });
    insertSlots(menuId, plan);
    deleteOrphanSuggestedRecipes();
    return menuId;
  });
}

export function acceptMenu(menuId) {
  const menu = getMenu(menuId);
  if (!menu || menu.status !== 'draft') throw new HttpError(404, 'Esa propuesta de menú ya no existe.');
  runInTransaction(() => {
    archiveActiveMenus();
    setMenuStatus(menuId, 'active');
  });
}

export function discardDraft(menuId) {
  const menu = getMenu(menuId);
  if (!menu || menu.status !== 'draft') throw new HttpError(404, 'Esa propuesta de menú ya no existe.');
  runInTransaction(() => {
    deleteMenu(menuId);
    deleteOrphanSuggestedRecipes();
  });
}

function requireActiveMenu() {
  const menu = getLatestMenu(['active']);
  if (!menu) throw new HttpError(404, 'No tienes ningún menú activo.');
  return menu;
}

const lastDayOf = (menu) => addDays(menu.startDate, menu.days - 1);

/**
 * Re-plans the days still to come (from today) keeping what is already cooked or
 * skipped. Used after a small purchase mid-cycle.
 */
export async function replanRemainingDays() {
  const menu = requireActiveMenu();
  const today = todayLocal();
  const fromDate = today > menu.startDate ? today : menu.startDate;
  const remaining = daysBetweenDays(fromDate, lastDayOf(menu)) + 1;
  if (remaining < 1) throw new HttpError(400, 'Este menú ya ha terminado: mejor estíralo unos días.');

  const kept = listSlots(menu.id).filter((s) => s.date < fromDate || s.status !== 'planned');
  const plan = await planWithAi({ days: listDays(fromDate, remaining), mealTypes: mealTypesToPlan(), keptDishes: kept.map((s) => s.title) });
  // Do not overwrite meals already cooked/skipped on those days.
  plan.slots = plan.slots.filter((slot) => !kept.some((k) => k.date === slot.date && k.mealType === slot.mealType));

  runInTransaction(() => {
    deletePlannedSlotsFrom(menu.id, fromDate);
    insertSlots(menu.id, plan);
    updateMenuSpan(menu.id, { days: menu.days, shoppingSuggestions: plan.shoppingSuggestions });
    deleteOrphanSuggestedRecipes();
  });
}

/**
 * Adds days after the end of the menu with what is left in the pantry
 * (when the menu is over and there was no new shop). The cycle is stretched too.
 */
export async function extendMenu(extraDays) {
  const menu = requireActiveMenu();
  const today = todayLocal();
  const nextDay = addDays(lastDayOf(menu), 1);
  const startDate = nextDay > today ? nextDay : today;
  const kept = listSlots(menu.id).map((s) => s.title);
  const plan = await planWithAi({ days: listDays(startDate, extraDays), mealTypes: mealTypesToPlan(), keptDishes: kept });

  runInTransaction(() => {
    insertSlots(menu.id, plan);
    const newLastDay = addDays(startDate, extraDays - 1);
    updateMenuSpan(menu.id, {
      days: daysBetweenDays(menu.startDate, newLastDay) + 1,
      shoppingSuggestions: [...menu.shoppingSuggestions, ...plan.shoppingSuggestions],
    });
    const cycle = getCurrentCycle();
    if (cycle) setCyclePlannedDays(cycle.id, Math.max(cycle.plannedDays, daysBetweenDays(cycle.startedAt.slice(0, 10), newLastDay) + 1));
  });
}

/**
 * Menu ready for the screen: days with their slots, each slot with its
 * restriction check (recomputed now, so profile changes are always applied).
 */
export function getMenuView(menuId) {
  const menu = getMenu(menuId);
  if (!menu) return null;
  const restrictions = getProfile().restrictions;
  const checks = new Map(); // recipeId → check, to check each recipe once

  const slots = listSlots(menuId).map((slot) => {
    if (slot.recipeId && !checks.has(slot.recipeId)) {
      checks.set(slot.recipeId, checkIngredients(getRecipe(slot.recipeId)?.ingredients ?? [], restrictions));
    }
    const check = checks.get(slot.recipeId) ?? { violations: [], unknown: [] };
    const leftoverOf = slot.leftoverOfSlotId ? getSlot(slot.leftoverOfSlotId) : null;
    return { ...slot, violations: check.violations, unknownIngredients: check.unknown, leftoverOf: leftoverOf && { date: leftoverOf.date, mealType: leftoverOf.mealType } };
  });

  const lastDay = lastDayOf(menu);
  const dayCount = daysBetweenDays(menu.startDate, lastDay) + 1;
  return {
    menu: { ...menu, endDate: lastDay },
    mealTypes: mealTypesToPlan(),
    days: listDays(menu.startDate, dayCount).map((day) => ({ ...day, slots: slots.filter((s) => s.date === day.date) })),
  };
}

// ---------- Managing slots ----------

function requireSlot(slotId) {
  const slot = getSlot(slotId);
  if (!slot) throw new HttpError(404, 'Ese plato ya no está en el menú.');
  return slot;
}

/**
 * Pantry products used by a recipe, with the level we propose after cooking
 * (one step lower). The user confirms before anything changes.
 */
export function proposePantryDeduction(recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return [];
  const lower = { high: 'medium', medium: 'low', low: 'empty' };
  const proposals = [];
  for (const ingredient of recipe.ingredients) {
    const productId = ingredient.productId ?? findProductByName(ingredient.name)?.id;
    const item = productId ? getPantryItemByProduct(productId) : null;
    if (item && item.level !== 'empty' && !proposals.some((p) => p.pantryItemId === item.id)) {
      proposals.push({ pantryItemId: item.id, name: item.name, currentLevel: item.level, proposedLevel: lower[item.level] });
    }
  }
  return proposals;
}

/**
 * planned → cooked: logs it in the history, the recipe joins the recipe book and
 * we return a proposal to lower the pantry. cooked → planned undoes the log.
 */
export function setSlotStatus(slotId, status) {
  const slot = requireSlot(slotId);
  return runInTransaction(() => {
    if (slot.status === 'cooked' && status !== 'cooked') deleteCookedForSlot(slotId);
    const updated = updateSlot(slotId, { status });
    let deduction = [];
    if (status === 'cooked' && slot.status !== 'cooked') {
      // Leftovers are eaten, not cooked: nothing to log or take from the pantry.
      if (!slot.isLeftover) {
        logCooked({ recipeId: slot.recipeId, title: slot.title, menuSlotId: slotId });
        if (slot.recipeId) {
          markRecipeSaved(slot.recipeId);
          deduction = proposePantryDeduction(slot.recipeId);
        }
      }
    }
    return { slot: updated, deduction };
  });
}

/** Moves a dish to another day/meal. If that place is taken, the two dishes swap. */
export function moveSlot(slotId, { date, mealType }) {
  const slot = requireSlot(slotId);
  const menu = getMenu(slot.menuId);
  if (date < menu.startDate || date > lastDayOf(menu)) throw new HttpError(400, 'Ese día no está en este menú.');
  runInTransaction(() => {
    const other = getSlotAt(slot.menuId, date, mealType);
    if (other && other.id !== slot.id) updateSlot(other.id, { date: slot.date, mealType: slot.mealType });
    updateSlot(slot.id, { date, mealType });
  });
}

/** Three alternatives for one dish, already filtered by the restrictions. Nothing is saved. */
export async function proposeAlternatives(slotId, request) {
  const slot = requireSlot(slotId);
  const [day] = listDays(slot.date, 1);
  const menuDishes = [...new Set(listSlots(slot.menuId).map((s) => s.title))];
  const result = await generateJson({
    ...buildAlternativesContext({ slot: { ...slot, ...day }, menuDishes, request }),
    schema: dishListSchema,
  });

  const restrictions = getProfile().restrictions;
  const alternatives = result.dishes
    .map(prepareDish)
    .filter(Boolean)
    .map((dish) => ({ dish, check: checkIngredients(ingredientsOf(dish), restrictions) }))
    .filter(({ check }) => check.violations.length === 0) // hard filter: never offered
    .map(({ dish, check }) => ({
      ...dish,
      name: dish.existingRecipe?.name ?? dish.name,
      timeMinutes: dish.existingRecipe?.timeMinutes ?? dish.timeMinutes,
      description: dish.existingRecipe?.description ?? dish.description,
      unknownIngredients: check.unknown,
    }));
  if (alternatives.length === 0) {
    throw new HttpError(502, 'Las alternativas no respetaban tus restricciones y las he descartado. Prueba otra vez.');
  }
  return alternatives.map(({ existingRecipe, ...dish }) => ({ ...dish, existingRecipeId: existingRecipe?.id ?? null }));
}

/**
 * Puts another dish in a slot: a saved recipe (`recipeId`) or one of the AI
 * alternatives (`dish`). Planned leftovers of the old dish follow the change.
 */
export function replaceSlotDish(slotId, { recipeId, dish }) {
  const slot = requireSlot(slotId);
  const restrictions = getProfile().restrictions;

  let prepared;
  if (recipeId) {
    const recipe = getRecipe(recipeId);
    if (!recipe) throw new HttpError(404, 'Esa receta no existe.');
    prepared = { name: recipe.name, existingRecipe: recipe };
  } else {
    prepared = prepareDish(dish);
    if (!prepared) throw new HttpError(400, 'Ese plato no tiene receta.');
  }

  // Hard filter also here: the client could send anything.
  const { violations } = checkIngredients(ingredientsOf(prepared), restrictions);
  if (violations.length > 0) {
    const list = violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ');
    throw new HttpError(422, `Ese plato no respeta tus restricciones: ${list}.`);
  }

  return runInTransaction(() => {
    const newRecipeId = saveDish(prepared);
    updateSlot(slotId, { recipeId: newRecipeId, title: prepared.name, status: 'planned', isLeftover: false, leftoverOfSlotId: null });
    for (const other of listSlots(slot.menuId)) {
      if (other.leftoverOfSlotId === slotId && other.status === 'planned') {
        updateSlot(other.id, { recipeId: newRecipeId, title: prepared.name });
      }
    }
    deleteOrphanSuggestedRecipes();
    return getSlot(slotId);
  });
}

/** Full recipe of a slot, with its restriction check (for the detail screen). */
export function getRecipeWithCheck(recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) throw new HttpError(404, 'Esa receta no existe.');
  return { ...recipe, check: checkIngredients(recipe.ingredients, getProfile().restrictions) };
}
