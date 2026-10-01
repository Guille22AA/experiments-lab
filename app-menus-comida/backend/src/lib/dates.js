// Calendar-day helpers working with "YYYY-MM-DD" strings (no time zone surprises).

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Today in the PC's local time, as "YYYY-MM-DD". */
export function todayLocal() {
  return new Date().toLocaleDateString('sv-SE'); // the Swedish format happens to be ISO
}

/** "2026-10-01" + 3 → "2026-10-04" */
export function addDays(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetweenDays(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000);
}

/** `count` consecutive days from `start`, with Spanish weekday name and weekend flag. */
export function listDays(start, count) {
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(start, index);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, weekday: WEEKDAYS[weekday], isWeekend: weekday === 0 || weekday === 6 };
  });
}
