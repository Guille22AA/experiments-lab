// What the AI returns in the chat: a text reply and, optionally, proposed actions.
// Each action is validated on its own later (domain/assistantActions.js), so one
// malformed action does not throw away the whole answer.
import { z } from 'zod';

export const chatTurnSchema = z.object({
  reply: z.string().trim().min(1),
  actions: z.array(z.object({ type: z.string() }).passthrough()).max(5).default([]),
});
