// /api/menus — the menu of the shopping cycle.
import { Router } from 'express';
import { z } from 'zod';
import { dishSchema } from '../ai/schemas/menuSchema.js';
import { getCycleStatus } from '../domain/cycles.js';
import {
  acceptMenu,
  discardDraft,
  extendMenu,
  generateMenu,
  getCurrentMenus,
  getMenuView,
  MAX_MENU_DAYS,
  moveSlot,
  proposeAlternatives,
  replaceSlotDish,
  replanRemainingDays,
  setSlotStatus,
} from '../domain/menus.js';
import { MEAL_TYPES } from '../domain/profile.js';
import { validate } from '../lib/validate.js';

export const menuRoutes = Router();

const idParam = (req) => validate(z.coerce.number().int().positive(), req.params.id);
const daysSchema = z.number().int().min(1).max(MAX_MENU_DAYS);

/** Active menu, pending draft and how many days we would plan by default. */
function currentState() {
  const { active, draft } = getCurrentMenus();
  const cycleStatus = getCycleStatus();
  // Default length: what is left of the cycle, or the usual time between shops.
  const suggestedDays = cycleStatus.cycle && !cycleStatus.isOverdue ? cycleStatus.daysLeft : cycleStatus.suggestedDays;
  return {
    active: active ? getMenuView(active.id) : null,
    draft: draft ? getMenuView(draft.id) : null,
    cycleStatus,
    suggestedDays: Math.min(Math.max(suggestedDays, 1), MAX_MENU_DAYS),
  };
}

menuRoutes.get('/current', (req, res) => {
  res.json(currentState());
});

// "hazme para 5 días": the user can change the number of days.
menuRoutes.post('/generate', async (req, res) => {
  const { days } = validate(z.object({ days: daysSchema }), req.body);
  await generateMenu({ days });
  res.json(currentState());
});

menuRoutes.post('/:id/accept', (req, res) => {
  acceptMenu(idParam(req));
  res.json(currentState());
});

menuRoutes.delete('/:id', (req, res) => {
  discardDraft(idParam(req));
  res.json(currentState());
});

// After a small purchase: plan again the days still to come.
menuRoutes.post('/current/replan', async (req, res) => {
  await replanRemainingDays();
  res.json(currentState());
});

// The menu is over and there was no shop: stretch it with what is left.
menuRoutes.post('/current/extend', async (req, res) => {
  const { days } = validate(z.object({ days: daysSchema }), req.body);
  await extendMenu(days);
  res.json(currentState());
});

// ---------- Slots ----------

menuRoutes.patch('/slots/:id', (req, res) => {
  const { status } = validate(z.object({ status: z.enum(['planned', 'cooked', 'skipped']) }), req.body);
  res.json(setSlotStatus(idParam(req), status));
});

menuRoutes.post('/slots/:id/move', (req, res) => {
  const target = validate(
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mealType: z.enum(MEAL_TYPES) }),
    req.body,
  );
  moveSlot(idParam(req), target);
  res.json(currentState());
});

menuRoutes.post('/slots/:id/alternatives', async (req, res) => {
  const { request } = validate(z.object({ request: z.string().trim().max(300).optional() }), req.body);
  res.json(await proposeAlternatives(idParam(req), request));
});

menuRoutes.post('/slots/:id/replace', (req, res) => {
  const body = validate(
    z.union([z.object({ recipeId: z.number().int().positive() }), z.object({ dish: dishSchema })]),
    req.body,
  );
  replaceSlotDish(idParam(req), body);
  res.json(currentState());
});
