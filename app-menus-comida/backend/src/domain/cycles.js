// Shopping cycles "from one shop to the next" (no AI).
//
// A normal purchase closes the current cycle and opens a new one. Extra
// purchases mid-cycle only add to the pantry. With time, the app learns how
// many days usually pass between shops and uses that as the default menu length.
import { getProfile } from '../db/repositories/profileRepo.js';
import { getCurrentCycle, listMainPurchaseDates } from '../db/repositories/purchaseRepo.js';

const PURCHASES_FOR_AVERAGE = 6; // look at the last 6 gaps between shops
const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day (midnight) of an ISO date, so "days" are counted as the user lives them. */
function startOfDay(isoDate) {
  const date = new Date(isoDate);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const daysBetween = (fromIso, toIso) => Math.round((startOfDay(toIso) - startOfDay(fromIso)) / DAY_MS);

/**
 * Average days between normal purchases, or null with fewer than 2 purchases.
 * @param {string} [extraDate] a purchase being registered right now (not saved yet)
 */
export function averageDaysBetweenPurchases(extraDate) {
  const dates = listMainPurchaseDates(PURCHASES_FOR_AVERAGE + 1);
  if (extraDate) dates.unshift(extraDate);
  dates.sort().reverse(); // newest first

  const gaps = [];
  for (let i = 0; i < dates.length - 1 && gaps.length < PURCHASES_FOR_AVERAGE; i++) {
    const gap = daysBetween(dates[i + 1], dates[i]);
    if (gap > 0) gaps.push(gap); // two shops on the same day do not count
  }
  if (gaps.length === 0) return null;
  const average = Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length);
  return Math.min(Math.max(average, 1), 31);
}

/** Default number of days to plan: the learned average, or the profile value until there is history. */
export function suggestedMenuDays(extraDate) {
  return averageDaysBetweenPurchases(extraDate) ?? getProfile().shoppingFrequencyDays;
}

/** Current cycle with "day X of Y" info for the UI. */
export function getCycleStatus(now = new Date().toISOString()) {
  const cycle = getCurrentCycle();
  const averageDays = averageDaysBetweenPurchases();
  if (!cycle) return { cycle: null, averageDays, suggestedDays: suggestedMenuDays() };

  const dayNumber = daysBetween(cycle.startedAt, now) + 1;
  return {
    cycle,
    dayNumber,
    daysLeft: Math.max(cycle.plannedDays - dayNumber + 1, 0),
    // The planned days are over and there was no new shop: the app will offer to stretch the menu (phase 3).
    isOverdue: dayNumber > cycle.plannedDays,
    averageDays,
    suggestedDays: suggestedMenuDays(),
  };
}
