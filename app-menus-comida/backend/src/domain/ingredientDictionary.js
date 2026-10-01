// Basic dictionary of common ingredients: which tags they carry and which
// supermarket section they usually live in. It works WITHOUT AI: when a new
// product appears, we look for these keywords in its name.
//
// It is intentionally small and simple. It's a first guess: Open Food Facts
// (phase 7) and the user's corrections improve it later.
import { normalizeName } from '../lib/text.js';

// Tag groups reused below.
const MEAT = ['contains_meat', 'animal_origin'];
const PORK = ['contains_meat', 'contains_pork', 'animal_origin'];
const FISH = ['contains_fish', 'animal_origin'];
const SHELLFISH = ['contains_shellfish', 'animal_origin'];
const DAIRY = ['contains_dairy', 'contains_lactose', 'animal_origin'];
const GLUTEN = ['contains_gluten'];

/**
 * Each entry: keywords (normalized, matched as whole words or word starts),
 * tags and section name (must match the seeded sections).
 * Order matters: the first entry that matches decides the section; tags add up
 * from every matching entry, unless an entry has `stop: true` (ends the search).
 */
const ENTRIES = [
  // Exceptions first, so that "sin gluten" / "sin lactosa" / "vegetal" products are not mis-tagged.
  { keywords: ['sin gluten'], tags: [], section: null },
  { keywords: ['sin lactosa'], tags: ['contains_dairy', 'animal_origin'], section: 'Lácteos y huevos' },
  { keywords: ['bebida de avena', 'bebida de soja', 'bebida de almendra', 'bebida de arroz'], tags: [], section: 'Lácteos y huevos' },
  { keywords: ['pasta de dientes', 'pasta dentifrica'], tags: [], section: 'Higiene', stop: true },
  { keywords: ['cerveza sin gluten'], tags: [], section: 'Bebidas', stop: true },
  // Instant noodles before meat, so "yatekomo pollo" goes to Despensa (it still gets the meat tag).
  { keywords: ['yatekomo', 'ramen', 'noodle', 'fideos orientales'], tags: GLUTEN, section: 'Despensa' },
  { keywords: ['cerveza'], tags: GLUTEN, section: 'Bebidas' },
  { keywords: ['soja texturizada', 'tofu', 'salsa de soja', 'soja'], tags: ['contains_soy'], section: 'Despensa' },

  // Fruit and vegetables
  {
    keywords: ['manzana', 'platano', 'naranja', 'mandarina', 'pera', 'fresa', 'uva', 'kiwi', 'limon', 'melon', 'sandia', 'piña', 'aguacate',
      'tomate', 'lechuga', 'cebolla', 'ajo', 'patata', 'zanahoria', 'pimiento', 'calabacin', 'berenjena', 'pepino', 'brocoli', 'coliflor',
      'espinaca', 'champiñon', 'seta', 'puerro', 'calabaza', 'judia verde', 'fruta', 'verdura', 'ensalada', 'perejil', 'cilantro'],
    tags: [],
    section: 'Fruta y verdura',
  },

  // Meat, fish and shellfish
  { keywords: ['jamon', 'chorizo', 'salchichon', 'fuet', 'lomo embuchado', 'bacon', 'panceta', 'sobrasada'], tags: PORK, section: 'Charcutería y quesos' },
  { keywords: ['pavo loncha', 'pechuga de pavo', 'mortadela', 'salchicha'], tags: MEAT, section: 'Charcutería y quesos' },
  { keywords: ['cerdo', 'costilla', 'secreto', 'presa', 'solomillo de cerdo', 'lomo'], tags: PORK, section: 'Carne' },
  { keywords: ['pollo', 'pavo', 'ternera', 'vacuno', 'cordero', 'carne', 'hamburguesa', 'filete', 'albondiga'], tags: MEAT, section: 'Carne' },
  { keywords: ['gamba', 'langostino', 'mejillon', 'calamar', 'sepia', 'pulpo', 'almeja', 'marisco', 'surimi'], tags: SHELLFISH, section: 'Pescado' },
  { keywords: ['atun', 'sardina', 'anchoa', 'caballa', 'bonito'], tags: FISH, section: 'Conservas' },
  { keywords: ['salmon', 'merluza', 'bacalao', 'dorada', 'lubina', 'pescado', 'rape', 'trucha', 'boqueron'], tags: FISH, section: 'Pescado' },

  // Dairy and eggs
  { keywords: ['huevo'], tags: ['contains_egg', 'animal_origin'], section: 'Lácteos y huevos' },
  { keywords: ['queso'], tags: DAIRY, section: 'Charcutería y quesos' },
  { keywords: ['leche', 'yogur', 'nata', 'mantequilla', 'kefir', 'cuajada', 'natillas', 'flan'], tags: DAIRY, section: 'Lácteos y huevos' },

  // Bakery and gluten
  { keywords: ['pan', 'baguette', 'chapata', 'tortilla de trigo', 'wrap', 'croissant', 'bolleria', 'magdalena'], tags: GLUTEN, section: 'Panadería' },
  { keywords: ['pasta', 'macarron', 'espagueti', 'spaghetti', 'tallarin', 'fideo', 'lasaña', 'cuscus', 'harina', 'pan rallado', 'galleta', 'cereales', 'avena'],
    tags: GLUTEN, section: 'Despensa' },

  // Pantry staples
  { keywords: ['almendra', 'nuez', 'avellana', 'anacardo', 'pistacho', 'frutos secos'], tags: ['contains_nuts'], section: 'Despensa' },
  { keywords: ['cacahuete'], tags: ['contains_peanuts'], section: 'Despensa' },
  { keywords: ['sesamo', 'tahini'], tags: ['contains_sesame'], section: 'Despensa' },
  { keywords: ['mayonesa'], tags: ['contains_egg', 'animal_origin'], section: 'Despensa' },
  { keywords: ['miel'], tags: ['animal_origin'], section: 'Despensa' },
  { keywords: ['arroz', 'lenteja', 'garbanzo', 'alubia', 'quinoa', 'aceite', 'vinagre', 'sal', 'azucar', 'especia', 'pimienta', 'oregano',
      'caldo', 'salsa', 'tomate frito', 'chocolate', 'cafe', 'infusion'], tags: [], section: 'Despensa' },
  { keywords: ['conserva', 'lata', 'maiz'], tags: [], section: 'Conservas' },

  // Frozen, drinks, cleaning, hygiene
  { keywords: ['congelad', 'helado', 'pizza'], tags: [], section: 'Congelados' },
  { keywords: ['agua', 'refresco', 'zumo', 'vino', 'coca cola', 'refresco de cola', 'bebida'], tags: [], section: 'Bebidas' },
  { keywords: ['detergente', 'lavavajillas', 'friegasuelos', 'lejia', 'bayeta', 'estropajo', 'papel de cocina', 'bolsa de basura', 'suavizante'],
    tags: [], section: 'Droguería y limpieza' },
  { keywords: ['champu', 'gel de ducha', 'gel de baño', 'desodorante', 'pasta de dientes', 'dentifrico', 'cepillo', 'papel higienico', 'compresa', 'cuchilla', 'crema hidratante', 'crema corporal'],
    tags: [], section: 'Higiene' },
];

/** Word-start match: "pan" matches "pan de molde" but not "panceta" or "champan". */
function containsKeyword(name, keyword) {
  return new RegExp(`(^| )${keyword}`).test(name);
}

/**
 * Guesses tags and section for a product name.
 * @returns {{ tags: string[], sectionName: string|null, matched: boolean }}
 *   matched = false means we know nothing about it (the app should warn).
 */
export function guessFromDictionary(productName) {
  const name = normalizeName(productName);
  const tags = new Set();
  let sectionName = null;
  let matched = false;

  for (const entry of ENTRIES) {
    if (entry.keywords.some((keyword) => containsKeyword(name, keyword))) {
      matched = true;
      entry.tags.forEach((tag) => tags.add(tag));
      sectionName ??= entry.section;
      // "sin gluten" products: drop the gluten tag later entries would add.
      if (entry.keywords.includes('sin gluten')) tags.add('__gluten_free');
      if (entry.stop) break;
    }
  }

  if (tags.has('__gluten_free')) {
    tags.delete('__gluten_free');
    tags.delete('contains_gluten');
  }
  if (containsKeyword(name, 'sin lactosa')) tags.delete('contains_lactose');

  return { tags: [...tags], sectionName, matched };
}
