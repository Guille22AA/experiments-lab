// Actions the assistant can PROPOSE. The AI never changes data: it returns
// actions as JSON, and for each type this file defines, in code:
//   schema   — what the payload must look like (zod)
//   describe — checks it against the real data and writes the confirmation
//              card text (the summary is written by code, not by the AI, so it
//              always says exactly what will happen)
//   apply    — runs it when the user taps "Aceptar"; returns what undo needs
//   undo     — puts things back as they were
// An action that makes no sense or breaks a restriction is rejected in
// `describe` with ActionRejected, and the user is told why.
import { z } from 'zod';
import { dishSchema } from '../ai/schemas/menuSchema.js';
import { recipeDraftSchema } from '../ai/schemas/recipeImportSchema.js';
import { deleteCookedLog, getSlot, getSlotAt, listSlots, logCooked, updateSlot, getMenu } from '../db/repositories/menuRepo.js';
import {
  deletePantryItemByProduct,
  getPantryItem,
  getPantryItemByProduct,
  restorePantryItem,
  setPantryLevel,
} from '../db/repositories/pantryRepo.js';
import { findProductByName } from '../db/repositories/productRepo.js';
import { getProfile, saveProfile } from '../db/repositories/profileRepo.js';
import { deleteOrphanSuggestedRecipes, deleteRecipe, getRecipe, listRecipeSummaries, markRecipeSaved } from '../db/repositories/recipeRepo.js';
import { createItem, deleteItem, listItems, updateItem } from '../db/repositories/shoppingListRepo.js';
import { runInTransaction } from '../db/transaction.js';
import { listDays } from '../lib/dates.js';
import { normalizeName } from '../lib/text.js';
import { moveSlot, proposePantryDeduction, replaceSlotDish, setSlotStatus } from './menus.js';
import { MEAL_TYPES, normalizeRestrictions, profileSchema } from './profile.js';
import { resolveProduct } from './products.js';
import { saveRecipe } from './recipes.js';
import { checkIngredients } from './restrictionCheck.js';
import { RESTRICTION_CODES } from './restrictions.js';
import { addToList } from './shoppingList.js';

/** The action cannot be offered; `message` is shown to the user in the chat. */
export class ActionRejected extends Error {}

const MEAL_NAMES = { breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snack: 'merienda' };
const LEVEL_NAMES = { high: 'mucho', medium: 'medio', low: 'poco', empty: 'se acabó' };

/** "la cena del jueves 2" */
function slotLabel(slot) {
  const [day] = listDays(slot.date, 1);
  return `la ${MEAL_NAMES[slot.mealType]} del ${day.weekday} ${Number(slot.date.slice(8))}`;
}

const listText = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`);
const sameText = (a, b) => normalizeName(a) === normalizeName(b);

function requireSlot(slotId) {
  const slot = getSlot(slotId);
  if (!slot) throw new ActionRejected('No encuentro ese plato en tu menú.');
  return slot;
}

function restrictionWarnings(ingredients) {
  const { violations, unknown } = checkIngredients(ingredients, getProfile().restrictions);
  return {
    violations,
    warnings: unknown.length ? [`Sin datos de alérgenos: ${unknown.join(', ')}`] : [],
  };
}

/** Recipe by id, or by name among the saved ones. */
function findRecipe({ recipeId, name }) {
  if (recipeId) return getRecipe(recipeId);
  if (!name) return null;
  const match = listRecipeSummaries().find((r) => sameText(r.name, name));
  return match ? getRecipe(match.id) : null;
}

/** Validates a full profile like the settings form does, then saves it. */
function saveValidProfile(profile) {
  const valid = profileSchema.parse({ ...profile, restrictions: profile.restrictions.map(({ code, label, note }) => ({ code, label, note })) });
  saveProfile({ ...valid, restrictions: normalizeRestrictions(valid.restrictions) });
}

function snapshotPantry(productId) {
  const item = getPantryItemByProduct(productId);
  return { productId, previous: item ? { level: item.level, addedAt: item.addedAt } : null };
}

function restorePantry(snapshots) {
  for (const { productId, previous } of snapshots) {
    if (previous) restorePantryItem({ productId, level: previous.level, addedAt: previous.addedAt });
    else deletePantryItemByProduct(productId);
  }
}

// ---------- Action types ----------

const ACTIONS = {
  replace_meal: {
    schema: z
      .object({ slotId: z.number().int().positive(), recipeId: z.number().int().positive().nullish(), dish: dishSchema.nullish() })
      .refine((p) => p.recipeId || p.dish, { message: 'recipeId or dish is required' }),
    describe(payload) {
      const slot = requireSlot(payload.slotId);
      const recipe = payload.recipeId ? getRecipe(payload.recipeId) : null;
      if (payload.recipeId && !recipe) throw new ActionRejected('No encuentro esa receta en tu recetario.');
      const name = recipe?.name ?? payload.dish.name;
      const ingredients = recipe ? recipe.ingredients : payload.dish.ingredients.map((i) => ({ name: i.name }));
      const { violations, warnings } = restrictionWarnings(ingredients);
      // Hard filter: a change that breaks a restriction is never offered.
      if (violations.length) {
        throw new ActionRejected(`He descartado cambiarlo por «${name}»: ${violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ')}.`);
      }
      return { summary: `¿Cambiar ${slotLabel(slot)} («${slot.title}») por «${name}»?`, warnings };
    },
    apply(payload) {
      const slot = requireSlot(payload.slotId);
      // The slot and its planned leftovers change together, so all of them are remembered.
      const affected = [slot, ...listSlots(slot.menuId).filter((s) => s.leftoverOfSlotId === slot.id)].map((s) => ({
        id: s.id, recipeId: s.recipeId, title: s.title, status: s.status, isLeftover: s.isLeftover, leftoverOfSlotId: s.leftoverOfSlotId,
      }));
      replaceSlotDish(slot.id, payload.recipeId ? { recipeId: payload.recipeId } : { dish: payload.dish });
      return { slots: affected };
    },
    undo({ slots }) {
      for (const { id, ...fields } of slots) if (getSlot(id)) updateSlot(id, fields);
      deleteOrphanSuggestedRecipes();
    },
  },

  move_meal: {
    schema: z.object({ slotId: z.number().int().positive(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mealType: z.enum(MEAL_TYPES) }),
    describe({ slotId, date, mealType }) {
      const slot = requireSlot(slotId);
      const menu = getMenu(slot.menuId);
      const lastDay = listDays(menu.startDate, menu.days).at(-1).date;
      if (date < menu.startDate || date > lastDay) throw new ActionRejected('Ese día no está en tu menú.');
      const target = { date, mealType };
      const other = getSlotAt(slot.menuId, date, mealType);
      const swap = other && other.id !== slot.id ? ` (se intercambia con «${other.title}»)` : '';
      return { summary: `¿Mover «${slot.title}» de ${slotLabel(slot)} a ${slotLabel(target)}${swap}?`, warnings: [] };
    },
    apply({ slotId, date, mealType }) {
      const slot = requireSlot(slotId);
      moveSlot(slotId, { date, mealType });
      return { slotId, date: slot.date, mealType: slot.mealType };
    },
    undo({ slotId, date, mealType }) {
      if (getSlot(slotId)) moveSlot(slotId, { date, mealType }); // moving back swaps back too
    },
  },

  update_profile: {
    schema: z.object({
      addLikes: z.array(z.string().trim().min(1).max(120)).default([]),
      removeLikes: z.array(z.string().trim().min(1).max(120)).default([]),
      addDislikes: z.array(z.string().trim().min(1).max(120)).default([]),
      removeDislikes: z.array(z.string().trim().min(1).max(120)).default([]),
      addRestrictions: z.array(z.object({ code: z.enum(RESTRICTION_CODES), label: z.string().max(120).nullish() })).default([]),
      removeRestrictions: z.array(z.string().trim().min(1).max(120)).default([]), // code or label
      addNotes: z.array(z.string().trim().min(1).max(300)).default([]),
      set: profileSchema.omit({ likes: true, dislikes: true, restrictions: true, extraNotes: true }).partial().default({}),
    }),
    /** Profile after the changes + human-readable list of what changes. */
    build(payload) {
      const current = getProfile();
      const without = (list, removed) => list.filter((item) => !removed.some((r) => sameText(r, item)));
      const addNew = (list, added) => [...list, ...added.filter((a) => !list.some((item) => sameText(item, a)))];
      const changes = [];

      // Something you now dislike stops being a like, and the other way round.
      const likes = addNew(without(current.likes, [...payload.removeLikes, ...payload.addDislikes]), payload.addLikes);
      const dislikes = addNew(without(current.dislikes, [...payload.removeDislikes, ...payload.addLikes]), payload.addDislikes);
      const added = (before, after) => after.filter((a) => !before.some((b) => sameText(a, b)));
      const removed = (before, after) => before.filter((b) => !after.some((a) => sameText(a, b)));
      if (added(current.likes, likes).length) changes.push(`te gusta: ${listText(added(current.likes, likes))}`);
      // A like that becomes a dislike (or the other way round) is only mentioned once.
      const noLongerLiked = removed(current.likes, likes).filter((x) => !payload.addDislikes.some((d) => sameText(d, x)));
      const noLongerDisliked = removed(current.dislikes, dislikes).filter((x) => !payload.addLikes.some((l) => sameText(l, x)));
      if (noLongerLiked.length) changes.push(`ya no te gusta tanto: ${listText(noLongerLiked)}`);
      if (added(current.dislikes, dislikes).length) changes.push(`no te gusta: ${listText(added(current.dislikes, dislikes))}`);
      if (noLongerDisliked.length) changes.push(`ya no lo evitas: ${listText(noLongerDisliked)}`);

      let restrictions = current.restrictions.filter(
        (r) => !payload.removeRestrictions.some((x) => x === r.code || sameText(x, r.label)),
      );
      for (const r of current.restrictions) if (!restrictions.includes(r)) changes.push(`quitar restricción: ${r.label}`);
      for (const r of normalizeRestrictions(payload.addRestrictions.map((x) => ({ code: x.code, label: x.label ?? undefined })))) {
        const exists = restrictions.some((x) => (x.code !== 'other' && x.code === r.code) || sameText(x.label, r.label));
        if (!exists) {
          restrictions = [...restrictions, r];
          changes.push(`añadir restricción: ${r.label}`);
        }
      }

      const extraNotes = addNew(current.extraNotes, payload.addNotes);
      if (extraNotes.length > current.extraNotes.length) changes.push(`apuntar: ${listText(added(current.extraNotes, extraNotes))}`);

      const SET_LABELS = {
        peopleCount: 'personas', weekdayMinutes: 'minutos entre semana', weekendMinutes: 'minutos el finde',
        cookingMotivation: 'ganas de cocinar', skillLevel: 'nivel', shoppingFrequencyDays: 'compras cada (días)',
        batchCooking: 'batch cooking', usesLeftovers: 'aprovechar sobras', mealsToPlan: 'comidas a planificar', equipment: 'utensilios',
      };
      const VALUE_LABELS = { low: 'pocas', medium: 'normales', high: 'muchas', beginner: 'principiante', intermediate: 'intermedio', advanced: 'avanzado', true: 'sí', false: 'no' };
      for (const [key, value] of Object.entries(payload.set)) {
        if (JSON.stringify(current[key]) === JSON.stringify(value)) continue;
        const shown = Array.isArray(value) ? value.map((v) => MEAL_NAMES[v] ?? v).join(', ') : VALUE_LABELS[value] ?? value;
        changes.push(`${SET_LABELS[key]}: ${shown}`);
      }

      const next = { ...current, ...payload.set, likes, dislikes, restrictions, extraNotes };
      return { next, current, changes };
    },
    describe(payload) {
      const { changes } = this.build(payload);
      if (changes.length === 0) throw new ActionRejected('Tu perfil ya estaba así, no hay nada que cambiar.');
      return { summary: `¿Actualizar tu perfil? ${changes.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join('. ')}.`, warnings: [] };
    },
    apply(payload) {
      const { next, current } = this.build(payload);
      saveValidProfile(next);
      return { previous: current };
    },
    undo({ previous }) {
      saveValidProfile(previous);
    },
  },

  add_to_shopping_list: {
    schema: z.object({
      items: z.array(z.object({ name: z.string().trim().min(1).max(120), quantity: z.string().trim().max(60).nullish() })).min(1).max(30),
    }),
    describe({ items }) {
      const names = items.map((i) => (i.quantity ? `${i.name} (${i.quantity})` : i.name));
      return { summary: `¿Añadir a la lista de la compra: ${listText(names)}?`, warnings: [] };
    },
    apply({ items }) {
      const created = [];
      const quantities = [];
      for (const item of items) {
        const before = listItems().find((i) => !i.checked && sameText(i.text, item.name));
        const result = addToList({ name: item.name, quantityText: item.quantity ?? null, source: 'chat' });
        if (result.alreadyThere) quantities.push({ id: result.id, quantityText: before?.quantityText ?? null });
        else created.push(result.id);
      }
      return { created, quantities };
    },
    undo({ created, quantities }) {
      for (const id of created) deleteItem(id);
      for (const { id, quantityText } of quantities) updateItem(id, { quantityText: quantityText ?? '' });
    },
  },

  remove_from_shopping_list: {
    schema: z.object({ items: z.array(z.string().trim().min(1).max(120)).min(1).max(30) }),
    match(names) {
      return listItems().filter((item) => names.some((name) => sameText(item.text, name) || normalizeName(item.text).includes(normalizeName(name))));
    },
    describe({ items }) {
      const found = this.match(items);
      if (found.length === 0) throw new ActionRejected(`No encuentro ${listText(items)} en tu lista de la compra.`);
      return { summary: `¿Quitar de la lista de la compra: ${listText(found.map((i) => i.text))}?`, warnings: [] };
    },
    apply({ items }) {
      const found = this.match(items);
      for (const item of found) deleteItem(item.id);
      return { removed: found };
    },
    undo({ removed }) {
      for (const item of removed) {
        const restored = createItem(item);
        if (item.checked) updateItem(restored.id, { checked: true });
      }
    },
  },

  update_pantry: {
    schema: z.object({
      items: z
        .array(z.object({ name: z.string().trim().min(1).max(120), level: z.enum(['empty', 'low', 'medium', 'high', 'remove']) }))
        .min(1)
        .max(30),
    }),
    describe({ items }) {
      const parts = items.map((item) => {
        if (item.level !== 'remove') return `${item.name} → ${LEVEL_NAMES[item.level]}`;
        const product = findProductByName(item.name);
        if (!product || !getPantryItemByProduct(product.id)) throw new ActionRejected(`${item.name} no está en tu despensa.`);
        return `quitar ${item.name}`;
      });
      return { summary: `¿Actualizar la despensa? ${listText(parts)}.`, warnings: [] };
    },
    apply({ items }) {
      const snapshots = [];
      for (const item of items) {
        const product = item.level === 'remove' ? findProductByName(item.name) : resolveProduct({ name: item.name });
        if (!product) continue;
        snapshots.push(snapshotPantry(product.id));
        if (item.level === 'remove') deletePantryItemByProduct(product.id);
        else setPantryLevel(product.id, item.level);
      }
      return { snapshots };
    },
    undo({ snapshots }) {
      restorePantry(snapshots);
    },
  },

  save_recipe: {
    schema: z.object({
      recipe: recipeDraftSchema,
      parentRecipeId: z.number().int().positive().nullish(),
      linkedProductName: z.string().trim().max(120).nullish(),
    }),
    toInput({ recipe, parentRecipeId, linkedProductName }) {
      return {
        ...recipe,
        ingredients: recipe.ingredients.map(({ quantity, ...i }) => ({ ...i, quantityText: quantity ?? null })),
        source: 'chat',
        isFavorite: false,
        parentRecipeId: parentRecipeId && getRecipe(parentRecipeId) ? parentRecipeId : null,
        linkedProductName: linkedProductName ?? null,
      };
    },
    describe(payload) {
      const input = this.toInput(payload);
      if (input.ingredients.length === 0) throw new ActionRejected('La receta no tiene ingredientes; cuéntame qué lleva.');
      const { violations, warnings } = restrictionWarnings(input.ingredients);
      // Your own recipe can be saved anyway, but very visibly flagged.
      if (violations.length) warnings.unshift(`No cumple tus restricciones: ${violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ')}`);
      const extra = [
        input.parentRecipeId ? `como variación de «${getRecipe(input.parentRecipeId).name}»` : null,
        input.linkedProductName ? `ligada a ${input.linkedProductName}` : null,
      ].filter(Boolean);
      return { summary: `¿Guardar la receta «${input.name}» en tu recetario${extra.length ? ` ${extra.join(' y ')}` : ''}?`, warnings };
    },
    apply(payload) {
      return { recipeId: saveRecipe(this.toInput(payload)) };
    },
    undo({ recipeId }) {
      deleteRecipe(recipeId);
    },
  },

  log_cooked_meal: {
    schema: z
      .object({
        slotId: z.number().int().positive().nullish(),
        recipeId: z.number().int().positive().nullish(),
        name: z.string().trim().min(1).max(120).nullish(),
        deductPantry: z.boolean().default(true),
      })
      .refine((p) => p.slotId || p.recipeId || p.name, { message: 'slotId, recipeId or name is required' }),
    resolve(payload) {
      const slot = payload.slotId ? requireSlot(payload.slotId) : null;
      if (slot && slot.status === 'cooked') throw new ActionRejected(`«${slot.title}» ya estaba marcado como cocinado.`);
      const recipe = slot?.recipeId ? getRecipe(slot.recipeId) : findRecipe(payload);
      const title = slot?.title ?? recipe?.name ?? payload.name;
      const deduction = payload.deductPantry && recipe && !slot?.isLeftover ? proposePantryDeduction(recipe.id) : [];
      return { slot, recipe, title, deduction };
    },
    describe(payload) {
      const { slot, title, deduction } = this.resolve(payload);
      const where = slot ? ` (${slotLabel(slot)})` : '';
      const pantry = deduction.length ? ` y bajar en la despensa: ${listText(deduction.map((d) => `${d.name} (${LEVEL_NAMES[d.currentLevel]} → ${LEVEL_NAMES[d.proposedLevel]})`))}` : '';
      return { summary: `¿Apuntar que has cocinado «${title}»${where}${pantry}?`, warnings: [] };
    },
    apply(payload) {
      const { slot, recipe, title, deduction } = this.resolve(payload);
      const pantryItems = deduction.map((d) => ({ item: getPantryItem(d.pantryItemId), level: d.proposedLevel })).filter((p) => p.item);
      const snapshots = pantryItems.map(({ item }) => snapshotPantry(item.productId));
      let cookedLogId = null;
      if (slot) {
        cookedLogId = setSlotStatus(slot.id, 'cooked').cookedLogId;
      } else {
        cookedLogId = logCooked({ recipeId: recipe?.id ?? null, title });
        if (recipe) markRecipeSaved(recipe.id);
      }
      for (const { item, level } of pantryItems) setPantryLevel(item.productId, level);
      return { slotId: slot?.id ?? null, cookedLogId, snapshots };
    },
    undo({ slotId, cookedLogId, snapshots }) {
      if (slotId && getSlot(slotId)) setSlotStatus(slotId, 'planned'); // also removes its cooked log
      else if (cookedLogId) deleteCookedLog(cookedLogId);
      restorePantry(snapshots);
    },
  },
};

export const ACTION_TYPES = Object.keys(ACTIONS);

/**
 * Validates an action proposed by the AI and prepares its confirmation card.
 * @returns {{ type, payload, summary, warnings }}
 * @throws ActionRejected (tell the user) or a zod error (malformed: ignore it)
 */
export function describeAction(raw) {
  const definition = ACTIONS[raw?.type];
  if (!definition) throw new Error(`Unknown action type ${raw?.type}`);
  const { type, ...rest } = raw;
  const payload = definition.schema.parse(rest);
  return { type, payload, ...definition.describe(payload) };
}

/** Applies an accepted action inside a transaction. Returns the undo data. */
export function applyAction(action) {
  const definition = ACTIONS[action.type];
  return runInTransaction(() => {
    definition.describe(action.payload); // checks again: data may have changed since it was proposed
    return definition.apply(action.payload);
  });
}

export function undoAction(action) {
  runInTransaction(() => ACTIONS[action.type].undo(action.undoData));
}

