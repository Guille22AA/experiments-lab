// Date labels for the menu ("Hoy", "Mañana", "jueves 2 oct").

export const todayIso = () => new Date().toLocaleDateString('sv-SE'); // "YYYY-MM-DD" in local time

/** "2026-10-02" → Date at noon (avoids time zone shifts). */
const toDate = (day) => new Date(`${day}T12:00:00`);

export function dayLabel(day) {
  const today = todayIso();
  const tomorrow = new Date(toDate(today).getTime() + 86_400_000).toLocaleDateString('sv-SE');
  const long = toDate(day).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
  if (day === today) return `Hoy · ${long}`;
  if (day === tomorrow) return `Mañana · ${long}`;
  return long.charAt(0).toUpperCase() + long.slice(1);
}

export const shortDayLabel = (day) => toDate(day).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
