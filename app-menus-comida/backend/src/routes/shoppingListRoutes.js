// /api/shopping-list — the list for the supermarket (no AI involved).
import { Router } from 'express';
import { z } from 'zod';
import { listSections, sectionExists } from '../db/repositories/sectionRepo.js';
import { createItem, deleteCheckedItems, deleteItem, getItem, listItems, updateItem } from '../db/repositories/shoppingListRepo.js';
import { addMenuSuggestionsToList, addPantryItemToList, addToList } from '../domain/shoppingList.js';
import { HttpError } from '../lib/errors.js';
import { validate } from '../lib/validate.js';

export const shoppingListRoutes = Router();

const idParam = (req) => validate(z.coerce.number().int().positive(), req.params.id);
const quantity = z.string().trim().max(60);

shoppingListRoutes.get('/', (req, res) => {
  res.json({ sections: listSections(), items: listItems() });
});

shoppingListRoutes.post('/', (req, res) => {
  const body = validate(
    z.object({
      productId: z.number().int().positive().optional(),
      name: z.string().trim().min(1).max(120),
      quantityText: quantity.nullish(),
      sectionId: z.number().int().positive().nullish(),
      source: z.enum(['manual', 'chat', 'pantry', 'menu']).default('manual'),
    }),
    req.body,
  );
  if (body.sectionId && !sectionExists(body.sectionId)) throw new HttpError(400, 'Esa sección no existe.');
  res.status(201).json(addToList(body));
});

shoppingListRoutes.post('/from-pantry/:id', (req, res) => {
  res.status(201).json(addPantryItemToList(idParam(req)));
});

shoppingListRoutes.post('/from-menu', (req, res) => {
  const { menuId } = validate(z.object({ menuId: z.number().int().positive().optional() }), req.body);
  res.json(addMenuSuggestionsToList(menuId));
});

shoppingListRoutes.patch('/:id', (req, res) => {
  const id = idParam(req);
  const body = validate(
    z.object({ checked: z.boolean().optional(), quantityText: quantity.nullish(), text: z.string().trim().min(1).max(120).optional() }),
    req.body,
  );
  if (!getItem(id)) throw new HttpError(404, 'Eso ya no está en la lista.');
  res.json(updateItem(id, { ...body, quantityText: body.quantityText === null ? '' : body.quantityText }));
});

// "Quitar lo tachado".
shoppingListRoutes.delete('/checked', (req, res) => {
  res.json({ removed: deleteCheckedItems() });
});

// Returns the deleted item so the UI can offer "Deshacer".
shoppingListRoutes.delete('/:id', (req, res) => {
  const id = idParam(req);
  const item = getItem(id);
  if (!item) throw new HttpError(404, 'Eso ya no está en la lista.');
  deleteItem(id);
  res.json(item);
});

shoppingListRoutes.post('/restore', (req, res) => {
  const item = validate(
    z.object({
      productId: z.number().int().positive().nullable(),
      text: z.string().min(1).max(120),
      quantityText: z.string().max(60).nullable(),
      source: z.enum(['manual', 'chat', 'pantry', 'menu']),
      menuId: z.number().int().positive().nullable(),
      createdAt: z.string(),
      checked: z.boolean(),
    }),
    req.body,
  );
  const restored = createItem(item); // keeps the original creation date, so it goes back to its place
  res.json(item.checked ? updateItem(restored.id, { checked: true }) : restored);
});
