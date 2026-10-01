// /api/chat — the always-available assistant, and its proposed actions.
import { Router } from 'express';
import { z } from 'zod';
import { listActionHistory } from '../db/repositories/actionRepo.js';
import { deleteMessages } from '../db/repositories/chatRepo.js';
import { acceptAction, listChat, rejectAction, sendChatMessage, undoAcceptedAction } from '../domain/assistantChat.js';
import { validate } from '../lib/validate.js';

export const chatRoutes = Router();

const HISTORY_SHOWN = 50; // messages shown when the panel opens (the AI only gets the last few)
const idParam = (req) => validate(z.coerce.number().int().positive(), req.params.id);

chatRoutes.get('/', (req, res) => {
  res.json(listChat(HISTORY_SHOWN));
});

const messageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // Where the chat was opened from, e.g. { name: 'menu_slot', label: 'Cena del jueves: …', slotId: 12 }.
  screen: z
    .object({
      name: z.string().max(50),
      label: z.string().max(200).optional(),
      slotId: z.number().int().positive().optional(),
      recipeId: z.number().int().positive().optional(),
    })
    .optional(),
});

chatRoutes.post('/messages', async (req, res) => {
  res.json(await sendChatMessage(validate(messageSchema, req.body)));
});

chatRoutes.delete('/', (req, res) => {
  deleteMessages('chat'); // the actions stay in the history (their message link is cleared)
  res.status(204).end();
});

// ---------- Actions (confirmation cards) ----------

chatRoutes.get('/actions/history', (req, res) => {
  res.json(listActionHistory().map(({ id, type, summary, status, resolvedAt }) => ({ id, type, summary, status, resolvedAt })));
});

chatRoutes.post('/actions/:id/accept', (req, res) => {
  res.json(acceptAction(idParam(req)));
});

chatRoutes.post('/actions/:id/reject', (req, res) => {
  res.json(rejectAction(idParam(req)));
});

chatRoutes.post('/actions/:id/undo', (req, res) => {
  res.json(undoAcceptedAction(idParam(req)));
});
