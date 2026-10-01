// What the AI must return after reading a supermarket receipt.
import { z } from 'zod';

export const ticketSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), // YYYY-MM-DD as printed on the receipt
  total: z.number().nonnegative().nullable(),
  items: z
    .array(
      z.object({
        rawText: z.string().trim().min(1), // the line exactly as printed
        name: z.string().trim().min(1), // generic product name in Spanish
        quantity: z.string().nullable(), // "2 ud", "0,5 kg"...
        price: z.number().nullable(), // line total in euros
        section: z.string().nullable(), // one of the supermarket sections
        tags: z.array(z.string()), // allergen/diet tags; unknown ones are dropped later
      }),
    )
    .min(1),
});
