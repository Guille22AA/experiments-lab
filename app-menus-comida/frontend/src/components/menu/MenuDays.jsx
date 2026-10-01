// The menu grouped by day, meals in the order of the day.
import { dayLabel, todayIso } from '../../lib/dates.js';
import SlotCard from './SlotCard.jsx';

export default function MenuDays({ view, onOpenSlot }) {
  const today = todayIso();
  const order = (mealType) => view.mealTypes.indexOf(mealType);

  return (
    <div className="menu-days">
      {view.days.map((day) => (
        <section key={day.date} className={`menu-day ${day.date < today ? 'is-past' : ''}`} aria-label={dayLabel(day.date)}>
          <h2 className="section-title">{dayLabel(day.date)}</h2>
          {day.slots.length === 0 ? (
            <p className="muted small">Nada planificado.</p>
          ) : (
            [...day.slots]
              .sort((a, b) => order(a.mealType) - order(b.mealType))
              .map((slot) => <SlotCard key={slot.id} slot={slot} onOpen={() => onOpenSlot(slot)} />)
          )}
        </section>
      ))}
    </div>
  );
}
