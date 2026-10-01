// contextBuilder: decides WHAT the AI gets to see for each task.
//
// The AI has no memory of its own: all memory lives in our database.
// For each task we pick and summarize only what is needed, so we spend few
// tokens and switching provider loses nothing.
import { getProfile } from '../db/repositories/profileRepo.js';
import { listRecentMessages } from '../db/repositories/chatRepo.js';
import { CHAT_PROMPT } from './prompts/chatPrompt.js';
import { ONBOARDING_PROMPT } from './prompts/onboardingPrompt.js';

const CHAT_HISTORY_LIMIT = 10; // last messages sent with each chat question
const ONBOARDING_HISTORY_LIMIT = 40; // the interview is short; it needs the whole conversation

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
