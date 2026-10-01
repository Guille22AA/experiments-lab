// /api/recipes — the recipe book.
import { Router } from 'express';
import { z } from 'zod';
import { deleteRecipe, getRecipe, listRecipeSummaries, setFavorite } from '../db/repositories/recipeRepo.js';
import { importFromText, importFromUrl } from '../domain/recipeImport.js';
import {
  addRecipeFeedback,
  feedbackSchema,
  getRecipeDetail,
  logCookedOutsideMenu,
  recipeInputSchema,
  saveRecipe,
} from '../domain/recipes.js';
import { HttpError } from '../lib/errors.js';
import { validate } from '../lib/validate.js';

export const recipeRoutes = Router();

const idParam = (req) => validate(z.coerce.number().int().positive(), req.params.id);

recipeRoutes.get('/', (req, res) => {
  res.json(listRecipeSummaries());
});

// ---------- Import (returns a draft to review; saves nothing) ----------

recipeRoutes.post('/import/text', async (req, res) => {
  const { text, answers } = validate(
    z.object({
      text: z.string().trim().min(10, 'Cuéntame un poco más.').max(5000),
      answers: z.array(z.object({ question: z.string().max(200), answer: z.string().trim().max(500) })).max(2).default([]),
    }),
    req.body,
  );
  res.json(await importFromText(text, answers.filter((a) => a.answer)));
});

recipeRoutes.post('/import/url', async (req, res) => {
  const { url } = validate(z.object({ url: z.string().trim().min(4).max(500) }), req.body);
  res.json(await importFromUrl(url.startsWith('http') ? url : `https://${url}`));
});

// ---------- One recipe ----------

recipeRoutes.get('/:id', (req, res) => {
  res.json(getRecipeDetail(idParam(req)));
});

recipeRoutes.post('/', (req, res) => {
  const id = saveRecipe(validate(recipeInputSchema, req.body));
  res.status(201).json(getRecipeDetail(id));
});

recipeRoutes.put('/:id', (req, res) => {
  const id = idParam(req);
  saveRecipe(validate(recipeInputSchema, req.body), id);
  res.json(getRecipeDetail(id));
});

recipeRoutes.delete('/:id', (req, res) => {
  const id = idParam(req);
  if (!getRecipe(id)) throw new HttpError(404, 'Esa receta no existe.');
  deleteRecipe(id); // menu dishes keep their name; variations stay as normal recipes
  res.status(204).end();
});

recipeRoutes.patch('/:id/favorite', (req, res) => {
  const id = idParam(req);
  const { isFavorite } = validate(z.object({ isFavorite: z.boolean() }), req.body);
  if (!getRecipe(id)) throw new HttpError(404, 'Esa receta no existe.');
  setFavorite(id, isFavorite);
  res.json({ isFavorite });
});

// "Hoy me he hecho esto" (outside the menu).
recipeRoutes.post('/:id/cooked', (req, res) => {
  res.json(logCookedOutsideMenu(idParam(req)));
});

recipeRoutes.post('/:id/feedback', (req, res) => {
  res.status(201).json(addRecipeFeedback(idParam(req), validate(feedbackSchema, req.body)));
});
