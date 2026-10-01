// /api/products — known products: search, guess for new names, edit.
import { Router } from 'express';
import { z } from 'zod';
import { getProduct, isNameTaken, searchProducts, setProductSection, updateProduct } from '../db/repositories/productRepo.js';
import { listSections, sectionExists } from '../db/repositories/sectionRepo.js';
import { runInTransaction } from '../db/transaction.js';
import { guessProductInfo } from '../domain/products.js';
import { HttpError } from '../lib/errors.js';
import { capitalize } from '../lib/text.js';
import { validate } from '../lib/validate.js';

export const productRoutes = Router();

productRoutes.get('/sections', (req, res) => {
  res.json(listSections());
});

// ?q=lech → matching known products (for the search box).
productRoutes.get('/', (req, res) => {
  const q = validate(z.string().trim().max(120).default(''), req.query.q);
  res.json(q ? searchProducts(q) : []);
});

// ?name=queso → section and tags we would give a new product (preview, nothing saved).
productRoutes.get('/guess', (req, res) => {
  const name = validate(z.string().trim().min(1).max(120), req.query.name);
  res.json(guessProductInfo(name));
});

productRoutes.patch('/:id', (req, res) => {
  const id = validate(z.coerce.number().int().positive(), req.params.id);
  const body = validate(
    z.object({ name: z.string().trim().min(1).max(120).optional(), sectionId: z.number().int().positive().optional() }),
    req.body,
  );
  if (!getProduct(id)) throw new HttpError(404, 'Ese producto no existe.');
  if (body.name && isNameTaken(body.name, id)) throw new HttpError(409, 'Ya tienes otro producto con ese nombre.');
  if (body.sectionId && !sectionExists(body.sectionId)) throw new HttpError(400, 'Esa sección no existe.');

  runInTransaction(() => {
    if (body.name) updateProduct(id, { name: capitalize(body.name) });
    if (body.sectionId) setProductSection(id, body.sectionId);
  });
  res.json(getProduct(id));
});
