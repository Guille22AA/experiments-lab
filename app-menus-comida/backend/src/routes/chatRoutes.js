// /api/chat — the always-available assistant.
import { Router } from 'express';
import { z } from 'zod';
import { generateText } from '../ai/aiService.js';
import { buildChatContext } from '../ai/contextBuilder.js';
import { addMessage, deleteMessages, listRecentMessages } from '../db/repositories/chatRepo.js';
import { validate } from '../lib/validate.js';

export const chatRoutes = Router();

const HISTORY_SHOWN = 50; // messages shown when the panel opens (the AI only gets the last few)

const toDto = ({ id, role, content, createdAt }) => ({ id, role, content, createdAt });

chatRoutes.get('/', (req, res) => {
  res.json(listRecentMessages('chat', HISTORY_SHOWN).map(toDto));
});

const messageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // Where the chat was opened from, e.g. { name: 'pantry', label: 'Despensa' }.
  screen: z.object({ name: z.string().max(50), label: z.string().max(200).optional() }).optional(),
});

chatRoutes.post('/messages', async (req, res) => {
  const { message, screen } = validate(messageSchema, req.body);
  // Saved first, so the question is not lost if the AI fails.
  addMessage({ role: 'user', content: message, mode: 'chat', screenContext: screen ?? null });

  const reply = await generateText(buildChatContext({ screen }));
  const saved = addMessage({ role: 'assistant', content: reply.trim(), mode: 'chat' });
  res.json(toDto(saved));
});

chatRoutes.delete('/', (req, res) => {
  deleteMessages('chat');
  res.status(204).end();
});
