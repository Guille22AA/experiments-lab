// What the AI returns when it turns a text (informal story or web page) into a recipe.
import { z } from 'zod';

export const recipeDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullish(),
  timeMinutes: z.number().int().min(1).max(1440).nullish(),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullish(),
  servings: z.number().int().min(1).max(50).nullish(),
  equipment: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        quantity: z.string().trim().max(60).nullish(),
        optional: z.boolean().default(false),
      }),
    )
    .max(60),
  steps: z.array(z.string().trim().min(1).max(1000)).max(40).default([]),
});

export const recipeImportSchema = z.object({
  recipe: recipeDraftSchema.nullable(), // null = there is no recipe in the text
  questions: z.array(z.string().trim().min(1).max(200)).max(2).default([]), // only what is essential and missing
  parentRecipeId: z.number().int().positive().nullable().default(null), // "it's a variation of my X"
  linkedProductName: z.string().trim().max(120).nullable().default(null), // "I make it with the yatekomos"
});
