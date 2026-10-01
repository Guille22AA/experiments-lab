// /api/recipes — the recipe book (basic version; phase 5 completes it).
import { Router } from 'express';
import { z } from 'zod';
import { listRecipeSummaries } from '../db/repositories/recipeRepo.js';
import { getRecipeWithCheck } from '../domain/menus.js';
import { validate } from '../lib/validate.js';

export const recipeRoutes = Router();

recipeRoutes.get('/', (req, res) => {
  res.json(listRecipeSummaries());
});

// Full recipe with its restriction check.
recipeRoutes.get('/:id', (req, res) => {
  res.json(getRecipeWithCheck(validate(z.coerce.number().int().positive(), req.params.id)));
});
