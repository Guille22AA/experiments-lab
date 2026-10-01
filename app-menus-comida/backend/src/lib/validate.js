import { z } from 'zod';
import { HttpError } from './errors.js';

// Validation messages in Spanish (they can reach the UI).
z.config(z.locales.es());

/**
 * Validates request data with a zod schema.
 * Returns the parsed data or throws a 400 error with a readable message.
 */
export function validate(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const details = result.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || 'datos'}: ${issue.message}`)
    .join('; ');
  throw new HttpError(400, `Datos no válidos (${details}).`);
}
