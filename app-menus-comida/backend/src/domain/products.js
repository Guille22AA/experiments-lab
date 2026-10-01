// Product "learning": the first time a product appears it gets a section and
// tags (dictionary, AI or user); from then on it is recognized by name or alias.
import {
  addAlias,
  createProduct,
  findProductByName,
  getProduct,
  setProductSection,
} from '../db/repositories/productRepo.js';
import { findSectionByName } from '../db/repositories/sectionRepo.js';
import { capitalize } from '../lib/text.js';
import { guessFromDictionary } from './ingredientDictionary.js';
import { TAGS } from './restrictions.js';

/**
 * What we would assign to a NEW product with this name (no database changes).
 * `hasTagData = false` means we know nothing about its allergens: the UI should warn.
 */
export function guessProductInfo(name, extraTags = []) {
  const guess = guessFromDictionary(name);
  const tags = [...new Set([...guess.tags, ...extraTags.filter((tag) => TAGS.includes(tag))])];
  return {
    sectionId: guess.sectionName ? (findSectionByName(guess.sectionName)?.id ?? null) : null,
    tags,
    hasTagData: guess.matched || extraTags.length > 0,
  };
}

/**
 * Returns the product for a purchase/pantry line, creating it if it is new.
 * @param {{ productId?: number, name: string, sectionId?: number|null, tags?: string[], rawText?: string|null }} line
 *   rawText = text as printed on the ticket; stored as an alias to recognize it next time.
 */
export function resolveProduct({ productId, name, sectionId = null, tags = [], rawText = null }) {
  let product = productId ? getProduct(productId) : findProductByName(name) ?? (rawText ? findProductByName(rawText) : null);

  if (!product) {
    const guess = guessProductInfo(name, tags);
    product = createProduct({
      name: capitalize(name),
      tags: guess.tags,
      tagsSource: tags.length > 0 ? 'ai' : guess.hasTagData ? 'dictionary' : null,
      sectionId: sectionId ?? guess.sectionId,
    });
  } else if (sectionId && sectionId !== product.sectionId) {
    // The user picked another section: remember it for next time.
    setProductSection(product.id, sectionId);
  }

  if (rawText) addAlias(product.id, rawText);
  return getProduct(product.id);
}
