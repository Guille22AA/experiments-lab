// Small helpers for the JSON text columns in SQLite.

/** Parses JSON text, returning `fallback` if it is empty or broken. */
export function parseJson(text, fallback) {
  if (text == null || text === '') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export const toJson = (value) => JSON.stringify(value ?? null);

export const nowIso = () => new Date().toISOString();
