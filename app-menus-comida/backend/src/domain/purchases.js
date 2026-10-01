// Registering a purchase: products → pantry, and cycles (no AI here; the
// ticket is read beforehand and the user always reviews the lines).
import { setPantryLevel } from '../db/repositories/pantryRepo.js';
import {
  addPurchaseItem,
  closeCycle,
  createCycle,
  createPurchase,
  getCurrentCycle,
  setCycleOpeningPurchase,
} from '../db/repositories/purchaseRepo.js';
import { deleteItemsForProducts } from '../db/repositories/shoppingListRepo.js';
import { runInTransaction } from '../db/transaction.js';
import { suggestedMenuDays } from './cycles.js';
import { LEVEL_AFTER_PURCHASE } from './pantry.js';
import { resolveProduct } from './products.js';

/**
 * @param {{
 *   kind: 'main' | 'extra',   // main = normal shop (opens a cycle), extra = small top-up
 *   purchasedAt: string,      // ISO date
 *   source: 'manual' | 'ticket_image' | 'ticket_pdf',
 *   totalPrice?: number|null,
 *   items: { productId?: number, name: string, sectionId?: number|null, level?: string,
 *            tags?: string[], rawText?: string|null, quantityText?: string|null, price?: number|null }[]
 * }} purchase
 */
export function registerPurchase({ kind, purchasedAt, source, totalPrice = null, items }) {
  return runInTransaction(() => {
    let cycleId = getCurrentCycle()?.id ?? null;
    const opensCycle = kind === 'main';

    if (opensCycle) {
      if (cycleId) closeCycle(cycleId, purchasedAt);
      cycleId = createCycle({ startedAt: purchasedAt, plannedDays: suggestedMenuDays(purchasedAt) });
    }

    const purchaseId = createPurchase({ cycleId, kind, purchasedAt, source, totalPrice });
    if (opensCycle) setCycleOpeningPurchase(cycleId, purchaseId);

    const boughtProductIds = [];
    for (const item of items) {
      const product = resolveProduct(item);
      addPurchaseItem({
        purchaseId,
        productId: product.id,
        rawText: item.rawText ?? null,
        quantityText: item.quantityText ?? null,
        price: item.price ?? null,
      });
      setPantryLevel(product.id, item.level ?? LEVEL_AFTER_PURCHASE);
      boughtProductIds.push(product.id);
    }

    // What was bought no longer needs to be on the shopping list.
    const removedFromList = deleteItemsForProducts(boughtProductIds);

    return { purchaseId, cycleId, openedCycle: opensCycle, itemCount: items.length, removedFromList };
  });
}
