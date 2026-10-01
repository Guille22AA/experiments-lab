// contextBuilder: decides WHAT the AI gets to see for each task.
//
// The AI has no memory of its own: all memory lives in our database.
// For each task we pick and summarize only what is needed, so we spend few
// tokens and switching provider loses nothing.
import { listRecentMessages } from '../db/repositories/chatRepo.js';
import { listRecentDishNames } from '../db/repositories/menuRepo.js';
import { listPantry } from '../db/repositories/pantryRepo.js';
import { getProfile } from '../db/repositories/profileRepo.js';
import { listRecipeSummaries } from '../db/repositories/recipeRepo.js';
import { daysBetweenDays, todayLocal } from '../lib/dates.js';
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

/**
 * Context for a chat question.
 * @param {{ screen?: { name: string, label?: string } }} options where the chat was opened from
 */
export function buildChatContext({ screen } = {}) {
  const profile = getProfile();
  const parts = [CHAT_PROMPT, '## Perfil del usuario', summarizeProfile(profile)];
  if (screen) parts.push('## Pantalla desde la que abre el chat', screen.label ?? screen.name);
  return { system: parts.join('\n\n'), messages: toTurns(listRecentMessages('chat', CHAT_HISTORY_LIMIT)) };
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

/** Saved recipes as short lines, plus the products that have a personal linked recipe. */
function summarizeRecipes() {
  const recipes = listRecipeSummaries()
    .sort((a, b) => b.timesCooked - a.timesCooked)
    .slice(0, RECIPES_LIMIT);
  if (recipes.length === 0) return { recipes: '(ninguna todavía)', linked: null };

  const lines = recipes.map((r) => {
    const details = [r.timeMinutes ? `${r.timeMinutes} min` : null, ...r.tags, r.timesCooked ? `cocinada ${r.timesCooked} veces` : null]
      .filter(Boolean)
      .join(', ');
    return `- id ${r.id}: ${r.name}${details ? ` (${details})` : ''}`;
  });

  const pantryProductIds = new Set(listPantry().filter((i) => i.level !== 'empty').map((i) => i.productId));
  const linked = recipes
    .filter((r) => r.linkedProductId && pantryProductIds.has(r.linkedProductId))
    .map((r) => `- ${r.linkedProductName}: no lo come tal cual, usa la receta id ${r.id} "${r.name}"`);

  return { recipes: lines.join('\n'), linked: linked.length ? linked.join('\n') : null };
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
  const { recipes, linked } = summarizeRecipes();
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
  const { recipes, linked } = summarizeRecipes();
  const target = `${LABELS[slot.mealType]} del ${slot.weekday} ${slot.date}${slot.isWeekend ? ' (fin de semana)' : ''}: ahora es "${slot.title}"`;

  const content = sections([
    '## Perfil del usuario', summarizeProfile(getProfile()),
    '## Despensa', summarizePantry(),
    '## Productos con receta personal ligada', linked,
    '## Saved recipes', recipes,
    '## Platos ya en el menú (no repetir)', menuDishes.join(', '),
    '## Plato a cambiar', target,
    '## Petición del usuario', request,
  ]);
  return { system: ALTERNATIVES_PROMPT, messages: [{ role: 'user', content }] };
}
