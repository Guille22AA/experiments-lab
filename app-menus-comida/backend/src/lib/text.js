// Text helpers for matching product names.

/** "  Leche ENTERA  Hacendado " → "leche entera hacendado" (lowercase, no accents, single spaces). */
export function normalizeName(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove accents
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "leche entera" → "Leche entera" */
export function capitalize(text) {
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
