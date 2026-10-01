// The chat: the AI answers and may propose actions; code checks each one and
// stores it as "proposed". Nothing changes until the user accepts a card.
import { generateJson } from '../ai/aiService.js';
import { buildChatContext } from '../ai/contextBuilder.js';
import { chatTurnSchema } from '../ai/schemas/chatSchema.js';
import { createAction, getAction, listActionsForMessages, setActionStatus } from '../db/repositories/actionRepo.js';
import { addMessage, listRecentMessages } from '../db/repositories/chatRepo.js';
import { HttpError } from '../lib/errors.js';
import { ActionRejected, applyAction, describeAction, undoAction } from './assistantActions.js';

const toActionDto = ({ id, type, summary, warnings, status }) => ({ id, type, summary, warnings, status });

/** Messages with their action cards, oldest first. */
export function listChat(limit) {
  const messages = listRecentMessages('chat', limit);
  const actions = listActionsForMessages(messages.map((m) => m.id));
  return messages.map(({ id, role, content, createdAt }) => ({
    id,
    role,
    content,
    createdAt,
    actions: actions.filter((a) => a.messageId === id).map(toActionDto),
  }));
}

/**
 * @param {{ message: string, screen?: { name, label?, slotId?, recipeId? } }} input
 */
export async function sendChatMessage({ message, screen }) {
  // Saved first, so the question is not lost if the AI fails.
  addMessage({ role: 'user', content: message, mode: 'chat', screenContext: screen ?? null });
  const turn = await generateJson({ ...buildChatContext({ screen }), schema: chatTurnSchema });

  const prepared = [];
  const notes = [];
  for (const raw of turn.actions) {
    try {
      prepared.push(describeAction(raw));
    } catch (error) {
      if (error instanceof ActionRejected) notes.push(error.message);
      else console.warn('[chat] Ignoring malformed action:', raw?.type, error.message);
    }
  }

  // Rejected proposals are explained to the user right in the reply.
  const content = [turn.reply, ...notes.map((note) => `⚠ ${note}`)].join('\n\n');
  const saved = addMessage({ role: 'assistant', content, mode: 'chat' });
  const actions = prepared.map((p) => createAction({ messageId: saved.id, ...p }));
  return { id: saved.id, role: 'assistant', content, createdAt: saved.createdAt, actions: actions.map(toActionDto) };
}

function requireAction(id, status) {
  const action = getAction(id);
  if (!action) throw new HttpError(404, 'Esa propuesta ya no existe.');
  if (action.status !== status) throw new HttpError(409, 'Esa propuesta ya estaba resuelta.');
  return action;
}

export function acceptAction(id) {
  const action = requireAction(id, 'proposed');
  try {
    return toActionDto(setActionStatus(id, 'accepted', applyAction(action)));
  } catch (error) {
    // E.g. the dish was deleted meanwhile: the card says it could not be done.
    setActionStatus(id, 'failed');
    if (error instanceof ActionRejected || error instanceof HttpError) throw new HttpError(409, error.message);
    throw error;
  }
}

export function rejectAction(id) {
  requireAction(id, 'proposed');
  return toActionDto(setActionStatus(id, 'rejected'));
}

export function undoAcceptedAction(id) {
  const action = requireAction(id, 'accepted');
  undoAction(action);
  return toActionDto(setActionStatus(id, 'undone'));
}
