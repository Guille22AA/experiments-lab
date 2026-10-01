// What the AI must return when it plans a menu or proposes alternative dishes.
import { z } from 'zod';
import { MEAL_TYPES } from '../../domain/profile.js';

export const DIFFICULTIES = ['easy', 'medium', 'hard'];

const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(120),
  quantity: z.string().trim().max(60).nullish(), // approximate: "200 g", "1 lata", "un puñado"
  optional: z.boolean().default(false),
});

/**
 * A dish. If it reuses a saved recipe, `existingRecipeId` is set and the rest may be omitted.
 * Otherwise every field describing the recipe is required.
 */
export const dishSchema = z
  .object({
    key: z.string().trim().min(1).max(20), // referenced by the slots, e.g. "d1"
    existingRecipeId: z.number().int().positive().nullable().default(null),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(300).nullish(),
    timeMinutes: z.number().int().min(1).max(600).nullish(),
    difficulty: z.enum(DIFFICULTIES).nullish(),
    servings: z.number().int().min(1).max(20).nullish(),
    equipment: z.array(z.string().max(40)).default([]),
    tags: z.array(z.string().max(40)).default([]),
    ingredients: z.array(ingredientSchema).max(40).default([]),
    steps: z.array(z.string().trim().min(1).max(600)).max(30).default([]),
  })
  .refine((dish) => dish.existingRecipeId || (dish.timeMinutes && dish.ingredients.length > 0 && dish.steps.length > 0), {
    message: 'new dishes need timeMinutes, ingredients and steps',
  });

const slotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(MEAL_TYPES),
  dishKey: z.string().trim().min(1),
  isLeftover: z.boolean().default(false), // eats leftovers of an earlier slot with the same dish
  batchGroup: z.string().trim().max(60).nullish(), // dishes cooked together in one session
});

export const menuPlanSchema = z.object({
  dishes: z.array(dishSchema).min(1).max(40),
  slots: z.array(slotSchema).min(1).max(100),
  shoppingSuggestions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.string().trim().max(60).nullish(),
        reason: z.string().trim().max(200).nullish(),
      }),
    )
    .max(60)
    .default([]),
});

/** Replacement dishes (to fix restriction problems, or alternatives for one meal). */
export const dishListSchema = z.object({ dishes: z.array(dishSchema).min(1).max(10) });
