// What the AI must return on each turn of the onboarding interview.
import { z } from 'zod';
import { profileSchema } from '../../domain/profile.js';

export const onboardingTurnSchema = z
  .object({
    reply: z.string().trim().min(1), // what the assistant says to the user
    done: z.boolean(), // true when the interview is finished
    profile: profileSchema.nullable(), // filled only when done = true
  })
  .refine((turn) => !turn.done || turn.profile, { message: 'profile is required when done is true', path: ['profile'] });
