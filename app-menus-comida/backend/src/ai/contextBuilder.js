// contextBuilder: decides WHAT the AI gets to see for each task.
//
// The AI has no memory of its own: all memory lives in our database.
// For each task we pick and summarize only what is needed, so we spend few
// tokens and switching provider loses nothing.
import { listActionsForMessages } from '../db/repositories/actionRepo.js';
import { listRecentMessages } from '../db/repositories/chatRepo.js';
import { getLatestMenu, getSlot, listRecentDishNames, listSlots } from '../db/repositories/menuRepo.js';
import { listPantry } from '../db/repositories/pantryRepo.js';
import { getProfile } from '../db/repositories/profileRepo.js';
import { getRecipe, listRecipeSummaries } from '../db/repositories/recipeRepo.js';
import { listItems } from '../db/repositories/shoppingListRepo.js';
import { daysBetweenDays, listDays, todayLocal } from '../lib/dates.js';
import { CHAT_PROMPT } from './prompts/chatPrompt.js';
import { ALTERNATIVES_PROMPT, MENU_PROMPT } from './prompts/menuPrompt.js';
import { ONBOARDING_PROMPT } from './prompts/onboardingPrompt.js';

const CHAT_HISTORY_LIMIT = 10; // last messages sent with each chat question
const ONBOARDING_HISTORY_LIMIT = 40; // the interview is short; it needs the whole conversation
const RECIPES_LIMIT = 40; // saved recipes sent when planning
const RECENT_MENUS = 2; // menus whose dishes should not be repeated

const LEVEL_LABELS = { high: 'mucho', medium: 'medio', low: 'poco', empty: 'se acabó' };

const LABELS = {
  breakfast: 'desayuno', lunch: 'comida', dinner: 'cena', snack: 'merienda',
  low: 'bajas', medium: 'normales', high: 'muchas',
  beginner: 'principiante', intermediate: 'intermedio', advanced: 'avanzado',
};

/** Short text summary of the profile (a few lines instead of the whole row). */
export function summarizeProfile(profile) {
  const list = (items) => (items.length ? items.join(', ') : '—');
  const restrictions = profile.restrictions.map((r) => (r.note ? `${r.label} (${r.note})` : r.label));
  return [
    `Restricciones (OBLIGATORIAS): ${list(restrictions)}`,
    `Le gusta: ${list(profile.likes)}`,
    `No le gusta: ${list(profile.dislikes)}`,
    `Personas: ${profile.peopleCount}. Planifica: ${list(profile.mealsToPlan.map((m) => LABELS[m] ?? m))}`,
    `Ganas de cocinar: ${LABELS[profile.cookingMotivation]}. Tiempo: ${profile.weekdayMinutes} min entre semana, ${profile.weekendMinutes} min el finde`,
    `Nivel: ${LABELS[profile.skillLevel]}. Utensilios: ${list(profile.equipment)}`,
    `Batch cooking: ${profile.batchCooking ? 'sí' : 'no'}. Aprovecha sobras: ${profile.usesLeftovers ? 'sí' : 'no'}`,
    `Compra cada ${profile.shoppingFrequencyDays} días`,
    profile.extraNotes.length ? `Otros: ${list(profile.extraNotes)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Context for one turn of the onboarding interview. */
export function buildOnboardingContext() {
  const profile = getProfile();
  let system = ONBOARDING_PROMPT;
  // When the interview is repeated, the current profile helps to ask only about changes.
  if (profile.onboardingCompletedAt) {
    system += `\n\n## Current profile (the user is redoing the interview; confirm or update it)\n${summarizeProfile(profile)}`;
  }
  return { system, messages: toTurns(listRecentMessages('onboarding', ONBOARDING_HISTORY_LIMIT)) };
}

const ACTION_STATUS = { proposed: 'pendiente', accepted: 'aceptada', rejected: 'rechazada', undone: 'deshecha', failed: 'falló' };

/** Active menu with slot ids, so the assistant can refer to a dish ("slot 12"). */
function summarizeActiveMenu() {
  const menu = getLatestMenu(['active']);
  if (!menu) return null;
  const weekday = new Map(listDays(menu.startDate, menu.days).map((d) => [d.date, d.weekday]));
  return listSlots(menu.id)
    .map((s) => {
      const status = s.status === 'planned' ? '' : ` [${s.status === 'cooked' ? 'hecho' : 'saltado'}]`;
      return `- slot ${s.id}: ${weekday.get(s.date) ?? ''} ${s.date}, ${LABELS[s.mealType]}: ${s.title}${s.isLeftover ? ' (sobras)' : ''}${status}`;
    })
    .join('\n');
}

/** Pending items of the shopping list. */
function summarizeShoppingList() {
  const pending = listItems().filter((i) => !i.checked);
  return pending.length ? pending.map((i) => `${i.text}${i.quantityText ? ` (${i.quantityText})` : ''}`).join(', ') : '(vacía)';
}

/** Full recipe as text (when the chat is opened from a dish or a recipe). */
function describeRecipe(recipeId) {
  const recipe = recipeId ? getRecipe(recipeId) : null;
  if (!recipe) return null;
  return [
    `"${recipe.name}" (id ${recipe.id}${recipe.timeMinutes ? `, ${recipe.timeMinutes} min` : ''})`,
    `Ingredientes: ${recipe.ingredients.map((i) => `${i.name}${i.quantityText ? ` (${i.quantityText})` : ''}`).join(', ')}`,
    recipe.steps.length ? `Pasos: ${recipe.steps.map((s, n) => `${n + 1}. ${s}`).join(' ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Context for a chat question. Always: profile, today's date, the active menu
 * (with ids), pantry, shopping list and recipe names, all summarized. Plus the
 * dish or recipe the chat was opened from, and the last messages.
 * @param {{ screen?: { name: string, label?: string, slotId?: number, recipeId?: number } }} options
 */
export function buildChatContext({ screen } = {}) {
  const [today] = listDays(todayLocal(), 1);
  const slot = screen?.slotId ? getSlot(screen.slotId) : null;
  const focusRecipe = describeRecipe(slot?.recipeId ?? screen?.recipeId);
  const recipes = listRecipeSummaries().slice(0, RECIPES_LIMIT).map((r) => `${r.id}: ${r.name}`).join('; ');

  const system = [
    CHAT_PROMPT,
    sections([
      '## Hoy', `${today.weekday} ${today.date}`,
      '## Perfil del usuario', summarizeProfile(getProfile()),
      '## Menú activo', summarizeActiveMenu(),
      '## Despensa', summarizePantry(),
      '## Lista de la compra', summarizeShoppingList(),
      '## Recetas guardadas (id: nombre)', recipes,
      '## Pantalla desde la que abre el chat', screen ? `${screen.label ?? screen.name}${slot ? ` (slot ${slot.id})` : ''}` : null,
      '## Receta de la que habla', focusRecipe,
    ]),
  ].join('\n\n');

  // Past proposals are shown to the AI next to its messages, with what the user decided.
  const messages = listRecentMessages('chat', CHAT_HISTORY_LIMIT);
  const actionsByMessage = Map.groupBy(listActionsForMessages(messages.map((m) => m.id)), (a) => a.messageId);
  const withActions = messages.map((m) => {
    const actions = actionsByMessage.get(m.id) ?? [];
    if (actions.length === 0) return m;
    const notes = actions.map((a) => `[Propuesta: ${a.summary} → ${ACTION_STATUS[a.status]}]`).join('\n');
    return { ...m, content: `${m.content}\n${notes}` };
  });

  return { system, messages: toTurns(withActions) };
}

/**
 * Turns stored messages into a clean conversation for the provider:
 * - it must start with a user turn (some providers reject anything else),
 * - consecutive turns of the same role are merged (happens when an AI call failed).
 */
function toTurns(messages) {
  const turns = [];
  for (const { role, content } of messages) {
    const last = turns.at(-1);
    if (last && last.role === role) last.content += `\n\n${content}`;
    else turns.push({ role, content });
  }
  if (turns[0]?.role === 'assistant') turns.unshift({ role: 'user', content: 'Hola.' });
  return turns;
}

/** Pantry as short lines: "Arroz (mucho, desde hace 12 días)". Empty items listed apart. */
export function summarizePantry() {
  const today = todayLocal();
  const items = listPantry();
  const available = items
    .filter((item) => item.level !== 'empty')
    .map((item) => {
      const days = daysBetweenDays(item.addedAt.slice(0, 10), today);
      return `- ${item.name} (${LEVEL_LABELS[item.level]}${days >= 7 ? `, desde hace ${days} días` : ''})`;
    });
  const finished = items.filter((item) => item.level === 'empty').map((item) => item.name);
  return [available.length ? available.join('\n') : '(vacía)', finished.length ? `Se acabó: ${finished.join(', ')}` : null]
    .filter(Boolean)
    .join('\n');
}

// How the latest feedback of a recipe is explained to the planner.
const VERDICT_HINTS = {
  loved: 'LE ENCANTÓ: repítela más',
  too_slow: 'tarda demasiado: solo en días con tiempo, o propón una versión más rápida',
  adjust: 'pidió ajustes',
};
const ADJUSTMENT_LABELS = {
  faster: 'más rápida', simpler: 'más sencilla', less_spicy: 'menos picante',
  more_spicy: 'más picante', lighter: 'más ligera', bigger: 'más cantidad',
};

/**
 * Saved recipes as short lines with the user's feedback, the ones NOT to
 * propose, and the products that have a personal linked recipe.
 */
function summarizeRecipes() {
  const all = listRecipeSummaries();
  const disliked = all.filter((r) => r.lastVerdict === 'disliked').map((r) => r.name);
  // Favourites and the most cooked first, so they survive the limit.
  const recipes = all
    .filter((r) => r.lastVerdict !== 'disliked')
    .sort((a, b) => b.isFavorite - a.isFavorite || b.timesCooked - a.timesCooked)
    .slice(0, RECIPES_LIMIT);

  const lines = recipes.map((r) => {
    const feedback = r.lastVerdict
      ? [VERDICT_HINTS[r.lastVerdict], ...r.lastAdjustments.map((a) => ADJUSTMENT_LABELS[a])].filter(Boolean).join(': ')
      : null;
    const details = [
      r.timeMinutes ? `${r.timeMinutes} min` : null,
      ...r.tags,
      r.isFavorite ? 'favorita' : null,
      r.parentName ? `variación de "${r.parentName}"` : null,
      r.timesCooked ? `cocinada ${r.timesCooked} veces` : null,
      feedback,
    ]
      .filter(Boolean)
      .join(', ');
    return `- id ${r.id}: ${r.name}${details ? ` (${details})` : ''}`;
  });

  const pantryProductIds = new Set(listPantry().filter((i) => i.level !== 'empty').map((i) => i.productId));
  const linked = recipes
    .filter((r) => r.linkedProductId && pantryProductIds.has(r.linkedProductId))
    .map((r) => `- ${r.linkedProductName}: no lo come tal cual, usa la receta id ${r.id} "${r.name}"`);

  return {
    recipes: lines.length ? lines.join('\n') : '(ninguna todavía)',
    disliked: disliked.length ? disliked.join(', ') : null,
    linked: linked.length ? linked.join('\n') : null,
  };
}

/** Joins [title, body, title, body...] pairs, skipping the sections whose body is empty. */
function sections(pairs) {
  const parts = [];
  for (let i = 0; i < pairs.length; i += 2) {
    if (pairs[i + 1]) parts.push(`${pairs[i]}\n${pairs[i + 1]}`);
  }
  return parts.join('\n\n');
}

/**
 * Context for planning a menu.
 * @param {{ days: { date, weekday, isWeekend }[], mealTypes: string[], keptDishes?: string[] }} plan
 *   keptDishes: dishes already fixed in the menu (when only the remaining days are planned)
 */
export function buildMenuContext({ days, mealTypes, keptDishes = [] }) {
  const { recipes, disliked, linked } = summarizeRecipes();
  const recent = listRecentDishNames(RECENT_MENUS);
  const plan = [
    `Comidas: ${mealTypes.map((m) => `${m} (${LABELS[m]})`).join(', ')}`,
    ...days.map((d) => `- ${d.date} (${d.weekday}${d.isWeekend ? ', fin de semana' : ''})`),
  ].join('\n');

  const content = sections([
    '## Perfil del usuario', summarizeProfile(getProfile()),
    '## Despensa', summarizePantry(),
    '## Productos con receta personal ligada', linked,
    '## Saved recipes', recipes,
    '## NO proponer (no le gustaron)', disliked,
    '## Platos de los últimos menús (no repetir)', recent.join(', '),
    '## Ya planificado en este menú (no repetir)', keptDishes.join(', '),
    '## A planificar', plan,
  ]);
  return { system: MENU_PROMPT, messages: [{ role: 'user', content }] };
}

/**
 * Context for proposing alternatives to one dish of the menu.
 * @param {{ slot: { date, weekday, isWeekend, mealType, title }, menuDishes: string[], request?: string }} options
 */
export function buildAlternativesContext({ slot, menuDishes, request }) {
  const { recipes, disliked, linked } = summarizeRecipes();
  const target = `${LABELS[slot.mealType]} del ${slot.weekday} ${slot.date}${slot.isWeekend ? ' (fin de semana)' : ''}: ahora es "${slot.title}"`;

  const content = sections([
    '## Perfil del usuario', summarizeProfile(getProfile()),
    '## Despensa', summarizePantry(),
    '## Productos con receta personal ligada', linked,
    '## Saved recipes', recipes,
    '## NO proponer (no le gustaron)', disliked,
    '## Platos ya en el menú (no repetir)', menuDishes.join(', '),
    '## Plato a cambiar', target,
    '## Petición del usuario', request,
  ]);
  return { system: ALTERNATIVES_PROMPT, messages: [{ role: 'user', content }] };
}
