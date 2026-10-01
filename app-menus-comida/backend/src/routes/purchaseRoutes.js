// /api/purchases — register purchases (by hand or from a receipt) and see the shopping cycle.
import { Router } from 'express';
import { z } from 'zod';
import { listPurchases, setCyclePlannedDays, getCurrentCycle } from '../db/repositories/purchaseRepo.js';
import { sectionExists } from '../db/repositories/sectionRepo.js';
import { getCycleStatus } from '../domain/cycles.js';
import { PANTRY_LEVELS } from '../domain/pantry.js';
import { registerPurchase } from '../domain/purchases.js';
import { readTicket, TICKET_MIME_TYPES } from '../domain/ticket.js';
import { HttpError } from '../lib/errors.js';
import { validate } from '../lib/validate.js';

export const purchaseRoutes = Router();

purchaseRoutes.get('/', (req, res) => {
  res.json(listPurchases());
});

// Step 1 (optional): read a receipt with the AI. Returns lines to review; saves nothing.
const ticketSchema = z.object({
  mimeType: z.enum(TICKET_MIME_TYPES),
  base64: z.string().min(100).max(14_000_000), // ~10 MB file
});

purchaseRoutes.post('/ticket', async (req, res) => {
  const file = validate(ticketSchema, req.body);
  res.json(await readTicket(file));
});

// Step 2: save the reviewed purchase.
const purchaseSchema = z.object({
  kind: z.enum(['main', 'extra']),
  purchasedAt: z.iso.datetime(),
  source: z.enum(['manual', 'ticket_image', 'ticket_pdf']),
  totalPrice: z.number().nonnegative().nullish(),
  items: z
    .array(
      z.object({
        productId: z.number().int().positive().nullish().transform((v) => v ?? undefined),
        name: z.string().trim().min(1).max(120),
        sectionId: z.number().int().positive().nullish(),
        level: z.enum(PANTRY_LEVELS).optional(),
        tags: z.array(z.string()).optional(),
        rawText: z.string().max(200).nullish(),
        quantityText: z.string().max(50).nullish(),
        price: z.number().nullish(),
      }),
    )
    .min(1, 'La compra no tiene productos.')
    .max(200),
});

purchaseRoutes.post('/', (req, res) => {
  const purchase = validate(purchaseSchema, req.body);
  if (purchase.items.some((item) => item.sectionId && !sectionExists(item.sectionId))) {
    throw new HttpError(400, 'Alguna sección no existe.');
  }
  const result = registerPurchase(purchase);
  res.status(201).json({ ...result, cycleStatus: getCycleStatus() });
});

// ---------- Cycle ----------

purchaseRoutes.get('/cycle', (req, res) => {
  res.json(getCycleStatus());
});

// Change the planned length of the current cycle ("hazme para 5 días").
purchaseRoutes.patch('/cycle', (req, res) => {
  const { plannedDays } = validate(z.object({ plannedDays: z.number().int().min(1).max(31) }), req.body);
  const cycle = getCurrentCycle();
  if (!cycle) throw new HttpError(404, 'No hay ningún ciclo abierto. Registra una compra normal para empezar uno.');
  setCyclePlannedDays(cycle.id, plannedDays);
  res.json(getCycleStatus());
});
