// /api/pantry — what is at home (no AI involved).
import { Router } from 'express';
import { z } from 'zod';
import {
  deletePantryItem,
  getPantryItem,
  getPantryItemByProduct,
  listPantry,
  restorePantryItem,
  setPantryLevel,
  updatePantryItemLevel,
} from '../db/repositories/pantryRepo.js';
import { listSections, sectionExists } from '../db/repositories/sectionRepo.js';
import { runInTransaction } from '../db/transaction.js';
import { PANTRY_LEVELS } from '../domain/pantry.js';
import { resolveProduct } from '../domain/products.js';
import { HttpError } from '../lib/errors.js';
import { validate } from '../lib/validate.js';

export const pantryRoutes = Router();

const idParam = (req) => validate(z.coerce.number().int().positive(), req.params.id);
const level = z.enum(PANTRY_LEVELS);

pantryRoutes.get('/', (req, res) => {
  res.json({ sections: listSections(), items: listPantry() });
});

// Adds a product (known or new) or, if it is already there, updates its level.
const addSchema = z.object({
  productId: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(120),
  sectionId: z.number().int().positive().nullish(),
  level: level.default('medium'),
});

pantryRoutes.post('/', (req, res) => {
  const body = validate(addSchema, req.body);
  if (body.sectionId && !sectionExists(body.sectionId)) throw new HttpError(400, 'Esa sección no existe.');
  const item = runInTransaction(() => {
    const product = resolveProduct(body);
    const alreadyThere = Boolean(getPantryItemByProduct(product.id));
    return { ...setPantryLevel(product.id, body.level), alreadyThere };
  });
  res.status(201).json(item);
});

pantryRoutes.patch('/:id', (req, res) => {
  const id = idParam(req);
  const body = validate(z.object({ level }), req.body);
  if (!getPantryItem(id)) throw new HttpError(404, 'Ese producto ya no está en la despensa.');
  res.json(updatePantryItemLevel(id, body.level));
});

// Returns the deleted item so the UI can offer "Deshacer".
pantryRoutes.delete('/:id', (req, res) => {
  const id = idParam(req);
  const item = getPantryItem(id);
  if (!item) throw new HttpError(404, 'Ese producto ya no está en la despensa.');
  deletePantryItem(id);
  res.json(item);
});

// Several levels at once (e.g. after cooking, the user confirms what was used).
pantryRoutes.post('/levels', (req, res) => {
  const { changes } = validate(
    z.object({ changes: z.array(z.object({ id: z.number().int().positive(), level })).min(1).max(100) }),
    req.body,
  );
  runInTransaction(() => {
    for (const change of changes) if (getPantryItem(change.id)) updatePantryItemLevel(change.id, change.level);
  });
  res.json({ updated: changes.length });
});

pantryRoutes.post('/restore', (req, res) => {
  const body = validate(z.object({ productId: z.number().int().positive(), level, addedAt: z.string() }), req.body);
  res.json(restorePantryItem(body));
});
