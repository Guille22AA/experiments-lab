// Simple, understandable health notes from Open Food Facts data (no AI).
// E.g. "Esta bebida es casi todo azúcar". Thresholds follow the usual
// "traffic light" levels that Open Food Facts already computes.
import { getProductByBarcode, searchProducts } from '../lib/openFoodFacts.js';
import { getProduct, setProductOffLink, updateProduct } from '../db/repositories/productRepo.js';
import { HttpError } from '../lib/errors.js';

const SUGAR_CUBE_GRAMS = 4;
const GLASS_ML = 250;

/** @returns {{ tone: 'good' | 'bad' | 'info', text: string }[]} */
export function healthNotes(info) {
  const notes = [];
  const { per100, levels } = info;

  if (info.isBeverage && per100.sugars >= 8) {
    const cubes = Math.round((per100.sugars * GLASS_ML) / 100 / SUGAR_CUBE_GRAMS);
    notes.push({ tone: 'bad', text: `Esta bebida es casi todo azúcar: unos ${cubes} terrones en un vaso.` });
  } else if (levels.sugars === 'high') {
    notes.push({ tone: 'bad', text: `Lleva mucho azúcar (${per100.sugars ?? '?'} g por cada 100 g).` });
  }
  if (levels.salt === 'high') notes.push({ tone: 'bad', text: `Lleva mucha sal (${per100.salt ?? '?'} g por cada 100 g).` });
  if (levels.saturatedFat === 'high') notes.push({ tone: 'bad', text: 'Tiene muchas grasas saturadas.' });
  else if (levels.fat === 'high') notes.push({ tone: 'bad', text: 'Tiene mucha grasa.' });
  if (info.nova === 4) notes.push({ tone: 'bad', text: 'Es un ultraprocesado: mejor de vez en cuando.' });
  if (info.nova === 1) notes.push({ tone: 'good', text: 'Alimento sin procesar o mínimamente procesado.' });
  if (info.nutriscore === 'a' || info.nutriscore === 'b') notes.push({ tone: 'good', text: 'Buena puntuación nutricional.' });
  if (notes.length === 0 && !info.nutriscore && !info.nova) {
    notes.push({ tone: 'info', text: 'Open Food Facts tiene pocos datos de este producto.' });
  }
  return notes;
}

const withNotes = (info) => ({ ...info, notes: healthNotes(info) });

/**
 * Health info of one of our products. If it is already linked to an Open Food
 * Facts product (barcode), that one is shown; otherwise, candidates to choose from.
 */
export async function getProductHealth(productId) {
  const product = getProduct(productId);
  if (!product) throw new HttpError(404, 'Ese producto no existe.');
  if (product.offBarcode) {
    const info = await getProductByBarcode(product.offBarcode);
    if (info) return { linked: withNotes(info), candidates: [] };
  }
  const candidates = await searchProducts(product.name);
  return { linked: null, candidates: candidates.map(withNotes) };
}

/**
 * Links our product to an Open Food Facts product. Its allergens are ADDED to
 * the product tags (never removed: for a hard filter, being cautious is better).
 */
export async function linkProductToOff(productId, barcode) {
  const product = getProduct(productId);
  if (!product) throw new HttpError(404, 'Ese producto no existe.');
  const info = await getProductByBarcode(barcode);
  if (!info) throw new HttpError(404, 'Open Food Facts no tiene ningún producto con ese código de barras.');
  setProductOffLink(productId, barcode);
  const tags = [...new Set([...product.tags, ...info.allergenTags])];
  if (tags.length !== product.tags.length || !product.tagsSource) updateProduct(productId, { tags, tagsSource: 'off' });
  return { linked: withNotes(info), candidates: [] };
}

export function unlinkProductFromOff(productId) {
  if (!getProduct(productId)) throw new HttpError(404, 'Ese producto no existe.');
  setProductOffLink(productId, null);
}
