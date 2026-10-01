// Profile shape and validation (shared by the settings form and the AI interview).
import { z } from 'zod';
import { RESTRICTION_CODES, RESTRICTIONS } from './restrictions.js';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];
export const EQUIPMENT = ['stovetop', 'oven', 'microwave', 'airfryer', 'food_processor', 'blender', 'pressure_cooker'];
export const MOTIVATION_LEVELS = ['low', 'medium', 'high'];
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'];
export const THEMES = ['system', 'light', 'dark'];

const shortText = z.string().trim().min(1).max(120);

export const restrictionSchema = z.object({
  code: z.enum(RESTRICTION_CODES),
  // For catalog codes the label is filled in from the catalog if missing.
  label: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).nullish(),
});

/** Editable profile fields. Used for PUT /api/profile and for the AI draft. */
export const profileSchema = z.object({
  peopleCount: z.number().int().min(1).max(20),
  mealsToPlan: z.array(z.enum(MEAL_TYPES)).min(1),
  cookingMotivation: z.enum(MOTIVATION_LEVELS),
  weekdayMinutes: z.number().int().min(5).max(300),
  weekendMinutes: z.number().int().min(5).max(480),
  skillLevel: z.enum(SKILL_LEVELS),
  equipment: z.array(z.enum(EQUIPMENT)),
  likes: z.array(shortText).max(100),
  dislikes: z.array(shortText).max(100),
  batchCooking: z.boolean(),
  usesLeftovers: z.boolean(),
  shoppingFrequencyDays: z.number().int().min(1).max(31),
  extraNotes: z.array(z.string().trim().min(1).max(300)).max(50),
  restrictions: z.array(restrictionSchema).max(30),
});

/** Gives every restriction a label (catalog label for known codes). */
export function normalizeRestrictions(restrictions) {
  return restrictions
    .map((r) => {
      const known = RESTRICTIONS[r.code];
      const label = known ? known.label : r.label?.trim();
      return { code: r.code, kind: known ? known.kind : 'other', label, note: r.note || null };
    })
    .filter((r) => r.label); // an `other` without text is useless
}
