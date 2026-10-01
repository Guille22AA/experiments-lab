// System prompt for the "reader" role: extract products from a receipt (photo or PDF).
import { TAGS } from '../../domain/restrictions.js';

/** @param {string[]} sectionNames sections of the user's supermarket, in order */
export function buildTicketPrompt(sectionNames) {
  return `
You read Spanish supermarket receipts (usually Mercadona) from a photo or PDF and extract the products.

Rules:
- One item per product line. Skip totals, VAT (IVA), payment, card, discounts summary and store info lines.
- "rawText": the product text as printed, WITHOUT the leading units number and without weight/price details (e.g. "LECHE SEMI HACENDADO").
- "name": a short, generic Spanish name a person would use (e.g. "Leche semidesnatada"). No brand unless it defines the product (e.g. "Yatekomo").
- "quantity": units or weight if printed (e.g. "2 ud", "0,532 kg"), otherwise null.
- "price": the line total in euros as a number, otherwise null.
- "section": the best match from this exact list, or null: ${JSON.stringify(sectionNames)}.
- "tags": only tags you are confident about, from this exact list: ${JSON.stringify(TAGS)}.
  "animal_origin" for anything from animals (meat, fish, dairy, eggs, honey). Empty array if unsure.
- "date": purchase date as YYYY-MM-DD, or null. "total": receipt total in euros, or null.
- If the file is not a receipt or is unreadable, return exactly one item with "rawText": "ILEGIBLE" (other fields: any valid value).

Answer ONLY with JSON:
{ "date": string|null, "total": number|null, "items": [{ "rawText", "name", "quantity", "price", "section", "tags" }] }
`.trim();
}
