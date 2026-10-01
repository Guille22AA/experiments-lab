// /api/onboarding — the first-run interview with the assistant.
//
// Flow: the user answers → the AI asks the next question → ... → the AI sets
// done = true with a profile draft → the app shows the draft in a form → the
// user confirms it with PUT /api/profile (completeOnboarding: true).
import { Router } from 'express';
import { z } from 'zod';
import { generateJson } from '../ai/aiService.js';
import { buildOnboardingContext } from '../ai/contextBuilder.js';
import { ONBOARDING_GREETING } from '../ai/prompts/onboardingPrompt.js';
import { onboardingTurnSchema } from '../ai/schemas/onboardingSchema.js';
import { addMessage, deleteMessages, listRecentMessages } from '../db/repositories/chatRepo.js';
import { normalizeRestrictions } from '../domain/profile.js';
import { validate } from '../lib/validate.js';

export const onboardingRoutes = Router();

/** The fixed greeting is written by code, which saves one AI call. */
function getConversation() {
  let messages = listRecentMessages('onboarding', 100);
  if (messages.length === 0) {
    addMessage({ role: 'assistant', content: ONBOARDING_GREETING, mode: 'onboarding' });
    messages = listRecentMessages('onboarding', 100);
  }
  // The draft (if any) is stored in the last assistant message that finished the interview.
  const finished = messages.findLast((m) => m.data?.done);
  return {
    messages: messages.map(({ id, role, content }) => ({ id, role, content })),
    draft: finished ? finished.data.profile : null,
  };
}

onboardingRoutes.get('/', (req, res) => {
  res.json(getConversation());
});

onboardingRoutes.post('/messages', async (req, res) => {
  const { message } = validate(z.object({ message: z.string().trim().min(1).max(2000) }), req.body);
  // Saved first, so the user's answer is not lost if the AI fails.
  addMessage({ role: 'user', content: message, mode: 'onboarding' });

  const turn = await generateJson({ ...buildOnboardingContext(), schema: onboardingTurnSchema });
  const draft = turn.done ? { ...turn.profile, restrictions: normalizeRestrictions(turn.profile.restrictions) } : null;
  addMessage({
    role: 'assistant',
    content: turn.reply,
    mode: 'onboarding',
    data: turn.done ? { done: true, profile: draft } : null,
  });

  res.json(getConversation());
});

// Starts the interview again (from Settings). The current profile is kept until a new one is confirmed.
onboardingRoutes.post('/reset', (req, res) => {
  deleteMessages('onboarding');
  res.json(getConversation());
});
