// /api/profile — read and edit the user profile (no AI involved).
import { Router } from 'express';
import { z } from 'zod';
import { getProfile, saveProfile, setTheme } from '../db/repositories/profileRepo.js';
import { normalizeRestrictions, profileSchema, THEMES } from '../domain/profile.js';
import { listRestrictionCatalog } from '../domain/restrictions.js';
import { validate } from '../lib/validate.js';

export const profileRoutes = Router();

profileRoutes.get('/', (req, res) => {
  res.json(getProfile());
});

// Saves the whole profile. `completeOnboarding: true` also marks the interview as done.
profileRoutes.put('/', (req, res) => {
  const body = validate(profileSchema.extend({ completeOnboarding: z.boolean().optional() }), req.body);
  const { completeOnboarding, ...profile } = body;
  const saved = saveProfile(
    { ...profile, restrictions: normalizeRestrictions(profile.restrictions) },
    { completeOnboarding },
  );
  res.json(saved);
});

profileRoutes.put('/theme', (req, res) => {
  const { theme } = validate(z.object({ theme: z.enum(THEMES) }), req.body);
  setTheme(theme);
  res.json({ theme });
});

// Known restrictions, for the checkboxes in Settings.
profileRoutes.get('/restriction-catalog', (req, res) => {
  res.json(listRestrictionCatalog());
});
