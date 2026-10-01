// Open Food Facts: free, public food database (https://world.openfoodfacts.org).
// No key needed, but they ask for an identifying User-Agent and few requests
// (searches are limited to about 10 per minute), so every answer is cached.
import { getCached, setCached } from '../db/repositories/offCacheRepo.js';
import { HttpError } from './errors.js';
import { normalizeName } from './text.js';

const BASE_URL = 'https://es.openfoodfacts.org'; // Spanish edition: better matches for Mercadona products
// Text search uses their newer search service (the old /cgi/search.pl is often overloaded).
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const USER_AGENT = 'app-menus-comida/0.1 (github.com/guille22aa)';
const TIMEOUT_MS = 10_000;
const CACHE_DAYS = 30;
const FIELDS = [
  'code', 'product_name', 'product_name_es', 'brands', 'image_small_url', 'nutriscore_grade', 'nova_group',
  'nutrient_levels', 'nutriments', 'allergens_tags', 'traces_tags', 'categories_tags', 'ingredients_analysis_tags',
].join(',');

// Open Food Facts allergen → our tags (domain/restrictions.js).
const ALLERGEN_TAGS = {
  'en:gluten': ['contains_gluten'],
  'en:milk': ['contains_dairy', 'contains_lactose', 'animal_origin'],
  'en:eggs': ['contains_egg', 'animal_origin'],
  'en:nuts': ['contains_nuts'],
  'en:peanuts': ['contains_peanuts'],
  'en:soybeans': ['contains_soy'],
  'en:fish': ['contains_fish', 'animal_origin'],
  'en:crustaceans': ['contains_shellfish', 'animal_origin'],
  'en:molluscs': ['contains_shellfish', 'animal_origin'],
  'en:sesame-seeds': ['contains_sesame'],
};

const round = (value) => (typeof value === 'number' ? Math.round(value * 10) / 10 : null);

/** OFF product → the small object the app uses. */
function simplify(product) {
  const n = product.nutriments ?? {};
  const tags = new Set((product.allergens_tags ?? []).flatMap((a) => ALLERGEN_TAGS[a] ?? []));
  if ((product.ingredients_analysis_tags ?? []).includes('en:non-vegan')) tags.add('animal_origin');
  const grade = (product.nutriscore_grade ?? '').toLowerCase();
  return {
    barcode: product.code,
    name: product.product_name_es || product.product_name || 'Sin nombre',
    // brands comes as "A, B" from the product API and as ["A", "B"] from the search service
    brand: (Array.isArray(product.brands) ? product.brands[0] : (product.brands ?? '').split(',')[0])?.trim() || null,
    imageUrl: product.image_small_url ?? null,
    nutriscore: /^[a-e]$/.test(grade) ? grade : null,
    nova: Number(product.nova_group) || null,
    levels: {
      fat: product.nutrient_levels?.fat ?? null,
      saturatedFat: product.nutrient_levels?.['saturated-fat'] ?? null,
      sugars: product.nutrient_levels?.sugars ?? null,
      salt: product.nutrient_levels?.salt ?? null,
    },
    per100: {
      kcal: round(n['energy-kcal_100g']),
      sugars: round(n.sugars_100g),
      fat: round(n.fat_100g),
      saturatedFat: round(n['saturated-fat_100g']),
      salt: round(n.salt_100g),
    },
    allergenTags: [...tags],
    traces: (product.traces_tags ?? []).map((t) => t.replace(/^\w+:/, '')),
    isBeverage: (product.categories_tags ?? []).includes('en:beverages'),
  };
}

async function request(url) {
  let response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new HttpError(503, 'Open Food Facts no responde ahora mismo. Prueba más tarde.');
  }
  if (response.status === 429) throw new HttpError(429, 'Open Food Facts pide esperar un poco entre búsquedas. Prueba en un minuto.');
  if (!response.ok && response.status !== 404) throw new HttpError(503, 'Open Food Facts no responde ahora mismo. Prueba más tarde.');
  return response.json();
}

/** Up to 5 products matching a name. */
export async function searchProducts(name) {
  const key = `search:${normalizeName(name)}`;
  const cached = getCached(key, CACHE_DAYS);
  if (cached) return cached;
  const data = await request(`${SEARCH_URL}?q=${encodeURIComponent(name)}&langs=es&page_size=5&fields=${FIELDS}`);
  const results = (data.hits ?? []).filter((p) => p.code).map(simplify);
  setCached(key, results);
  return results;
}

/** One product by barcode, or null if Open Food Facts does not have it. */
export async function getProductByBarcode(barcode) {
  const key = `code:${barcode}`;
  const cached = getCached(key, CACHE_DAYS);
  if (cached) return cached;
  const data = await request(`${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`);
  if (data.status !== 1 || !data.product) return null;
  const product = simplify(data.product);
  setCached(key, product);
  return product;
}
