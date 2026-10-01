// Shopping list rules (no AI).
// Items are linked to products when possible: that way they are sorted by
// section and the app keeps learning products.
import { getLatestMenu, getMenu } from '../db/repositories/menuRepo.js';
import { getPantryItem } from '../db/repositories/pantryRepo.js';
import { createItem, findPendingItemByProduct, updateItem } from '../db/repositories/shoppingListRepo.js';
import { runInTransaction } from '../db/transaction.js';
import { HttpError } from '../lib/errors.js';
import { resolveProduct } from './products.js';

/**
 * Adds something to the list. If the product is already pending, it is not
 * duplicated: the quantity is updated instead (when a new one is given).
 * @returns item + `alreadyThere`
 */
export function addToList({ productId, name, quantityText = null, sectionId = null, source, menuId = null }) {
  return runInTransaction(() => {
    const product = resolveProduct({ productId, name, sectionId });
    const pending = findPendingItemByProduct(product.id);
    if (pending) {
      const item = quantityText ? updateItem(pending.id, { quantityText }) : pending;
      return { ...item, alreadyThere: true };
    }
    return { ...createItem({ productId: product.id, text: product.name, quantityText, source, menuId }), alreadyThere: false };
  });
}

/** "Se acabó → a la lista" from the pantry. */
export function addPantryItemToList(pantryItemId) {
  const pantryItem = getPantryItem(pantryItemId);
  if (!pantryItem) throw new HttpError(404, 'Ese producto ya no está en la despensa.');
  return addToList({ productId: pantryItem.productId, name: pantryItem.name, source: 'pantry' });
}

/** Moves the menu's shopping suggestions to the list. Returns how many were new. */
export function addMenuSuggestionsToList(menuId) {
  const menu = menuId ? getMenu(menuId) : getLatestMenu(['active']);
  if (!menu) throw new HttpError(404, 'No hay ningún menú del que sacar la compra.');
  let added = 0;
  for (const suggestion of menu.shoppingSuggestions) {
    const item = addToList({ name: suggestion.name, quantityText: suggestion.quantity ?? null, source: 'menu', menuId: menu.id });
    if (!item.alreadyThere) added += 1;
  }
  return { added, total: menu.shoppingSuggestions.length };
}
