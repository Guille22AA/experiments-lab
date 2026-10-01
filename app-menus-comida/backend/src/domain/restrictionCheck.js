// HARD check of dietary restrictions, done in code (never trusted to the AI).
//
// Every ingredient gets its tags from, in this order:
//   1. the known product it is linked to (learned from tickets / edited by the user),
//   2. a known product with the same name,
//   3. the ingredient dictionary.
// If none of them knows the ingredient, it is "unknown": the app warns instead
// of assuming it is fine.
import { findProductByName, getProduct } from '../db/repositories/productRepo.js';
import { normalizeName } from '../lib/text.js';
import { guessFromDictionary } from './ingredientDictionary.js';
import { RESTRICTIONS } from './restrictions.js';

// Words ignored when turning a free-text restriction ("Alergia al kiwi") into keywords.
const FILLER_WORDS = new Set(['alergia', 'alergico', 'alergica', 'intolerancia', 'intolerante', 'sin', 'nada', 'de', 'del', 'al', 'a', 'la', 'el', 'los', 'las', 'no', 'puedo', 'comer', 'tomar']);

/** "Alergia al kiwi" → ["kiwi"] */
function keywordsOf(label) {
  return normalizeName(label)
    .split(' ')
    .filter((word) => word.length >= 3 && !FILLER_WORDS.has(word));
}

/** Tags of one ingredient, or null when nothing is known about it. */
function tagsOfIngredient({ name, productId }) {
  const product = (productId && getProduct(productId)) || findProductByName(name);
  if (product && product.tagsSource) return product.tags;
  const guess = guessFromDictionary(name);
  if (guess.matched) return guess.tags;
  if (product) return product.tags.length ? product.tags : null; // product without tag info
  return null;
}

/**
 * @param {{ name: string, productId?: number|null, optional?: boolean }[]} ingredients
 * @param {{ code: string, label: string }[]} restrictions the profile restrictions
 * @returns {{ violations: { ingredient: string, restriction: string }[], unknown: string[] }}
 *   violations: ingredient breaks a restriction → must not be shown as safe
 *   unknown: no data about the ingredient → warn the user
 */
export function checkIngredients(ingredients, restrictions) {
  const violations = [];
  const unknown = [];
  if (restrictions.length === 0) return { violations, unknown };

  const catalogRestrictions = restrictions.filter((r) => RESTRICTIONS[r.code]);
  const otherRestrictions = restrictions.filter((r) => r.code === 'other');

  for (const ingredient of ingredients) {
    // Free-text restrictions can only be checked by name.
    const normalized = normalizeName(ingredient.name);
    for (const restriction of otherRestrictions) {
      if (keywordsOf(restriction.label).some((keyword) => normalized.includes(keyword))) {
        violations.push({ ingredient: ingredient.name, restriction: restriction.label });
      }
    }

    if (catalogRestrictions.length === 0) continue;
    const tags = tagsOfIngredient(ingredient);
    if (tags === null) {
      unknown.push(ingredient.name);
      continue;
    }
    for (const restriction of catalogRestrictions) {
      if (RESTRICTIONS[restriction.code].forbids.some((tag) => tags.includes(tag))) {
        violations.push({ ingredient: ingredient.name, restriction: restriction.label });
      }
    }
  }

  return { violations, unknown };
}
