// Reading recipes from web pages WITHOUT AI.
// Many recipe sites include a machine-readable copy of the recipe (schema.org
// "Recipe" in a JSON-LD script). If it is there, we use it directly.

// Named HTML entities common in Spanish recipe pages ("Fre&iacute;r" → "Freír").
const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', deg: '°', iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', ccedil: 'ç',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  frac12: '½', frac14: '¼', frac34: '¾', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
};

export function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name] ?? ENTITIES[name.toLowerCase()] ?? match);
}

const clean = (value) => (typeof value === 'string' ? decodeEntities(value.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '');

const isRecipeType = (type) => (Array.isArray(type) ? type.includes('Recipe') : type === 'Recipe');

/** Looks for a Recipe object anywhere inside a JSON-LD value. */
function findRecipeNode(node) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (isRecipeType(node['@type'])) return node;
  return findRecipeNode(node['@graph']);
}

export function findJsonLdRecipe(html) {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, content] of scripts) {
    try {
      const recipe = findRecipeNode(JSON.parse(content.trim()));
      if (recipe) return recipe;
    } catch {
      // broken JSON-LD on the page: try the next one
    }
  }
  return null;
}

/** "PT1H30M" → 90 */
function parseDuration(value) {
  const match = typeof value === 'string' && value.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return null;
  const minutes = Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  return minutes > 0 ? minutes : null;
}

/** "4 raciones" / ["4"] / 4 → 4 */
function parseYield(value) {
  const text = Array.isArray(value) ? value[0] : value;
  const match = String(text ?? '').match(/\d+/);
  return match ? Math.min(Number(match[0]), 50) : null;
}

const UNIT = String.raw`(?:kg|g|gr|gramos?|ml|cl|l|litros?|cucharadas?|cucharaditas?|cdas?|cdtas?|tazas?|vasos?|unidad(?:es)?|ud|dientes?|pizcas?|latas?|botes?|sobres?|rebanadas?|lonchas?|ramitas?|hojas?|puñados?|chorritos?|chorros?)\.?`;
const INGREDIENT_PATTERN = new RegExp(String.raw`^([\d.,/½¼¾⅓]+(?:\s*-\s*[\d.,/]+)?\s*(?:${UNIT})?)\s+(?:de\s+)?(.+)$`, 'i');

/** "200 g de harina" → { quantityText: "200 g", name: "Harina" } */
export function splitIngredient(text) {
  const line = clean(text);
  const match = line.match(INGREDIENT_PATTERN);
  const [quantityText, name] = match ? [match[1].trim(), match[2].trim()] : [null, line];
  return { name: name.charAt(0).toUpperCase() + name.slice(1), quantityText, optional: /opcional/i.test(line) };
}

/** recipeInstructions can be a text, a list of texts, HowToSteps or HowToSections. */
function flattenInstructions(value) {
  if (!value) return [];
  if (typeof value === 'string') return clean(value).split(/(?<=\.)\s+(?=[A-ZÁÉÍÓÚ])/).filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(flattenInstructions);
  if (value.itemListElement) return flattenInstructions(value.itemListElement);
  return value.text ? [clean(value.text)] : [];
}

/** Converts a schema.org Recipe into our recipe draft. */
export function jsonLdToDraft(recipe) {
  const asList = (value) => (Array.isArray(value) ? value : value ? String(value).split(',') : []);
  const tags = [...asList(recipe.recipeCuisine), ...asList(recipe.recipeCategory)].map(clean).filter(Boolean).slice(0, 6);
  return {
    name: clean(recipe.name) || 'Receta importada',
    description: clean(recipe.description).slice(0, 500) || null,
    timeMinutes: parseDuration(recipe.totalTime) ?? ((parseDuration(recipe.prepTime) ?? 0) + (parseDuration(recipe.cookTime) ?? 0) || null),
    difficulty: null,
    servings: parseYield(recipe.recipeYield),
    equipment: [],
    tags: tags.map((tag) => tag.toLowerCase()),
    ingredients: asList(recipe.recipeIngredient).map(splitIngredient).filter((i) => i.name).slice(0, 60),
    steps: flattenInstructions(recipe.recipeInstructions).filter(Boolean).slice(0, 40),
  };
}

/** Visible text of a page, for the AI when there is no JSON-LD. */
export function htmlToText(html, maxChars = 15_000) {
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|p|div|li|h[1-6]|tr|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, maxChars);
}
