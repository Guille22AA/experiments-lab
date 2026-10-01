// One dish of the menu (a meal of a day). Tapping it opens the detail.
import { AlertTriangle, Check, Clock, Layers, Repeat, SkipForward } from 'lucide-react';
import { MEAL_TYPE_LABELS } from '../../constants/labels.js';
import { shortDayLabel } from '../../lib/dates.js';

export default function SlotCard({ slot, onOpen }) {
  const hasViolations = slot.violations.length > 0;

  return (
    <button type="button" className={`slot-card status-${slot.status} ${hasViolations ? 'has-violations' : ''}`} onClick={onOpen}>
      <span className="slot-meal">{MEAL_TYPE_LABELS[slot.mealType]}</span>
      <span className="slot-title">
        {slot.status === 'cooked' && <Check size={18} aria-label="Hecho" />}
        {slot.status === 'skipped' && <SkipForward size={18} aria-label="Saltado" />}
        {slot.title}
      </span>
      <span className="slot-meta">
        {slot.timeMinutes && (
          <span>
            <Clock size={14} aria-hidden="true" /> {slot.timeMinutes} min
          </span>
        )}
        {slot.isLeftover && slot.leftoverOf && (
          <span>
            <Repeat size={14} aria-hidden="true" /> Sobras de la {MEAL_TYPE_LABELS[slot.leftoverOf.mealType].toLowerCase()} del {shortDayLabel(slot.leftoverOf.date)}
          </span>
        )}
        {slot.batchGroup && !slot.isLeftover && (
          <span>
            <Layers size={14} aria-hidden="true" /> {slot.batchGroup}
          </span>
        )}
      </span>

      {/* Restrictions: very visible when broken, discreet when there is no data. */}
      {hasViolations && (
        <span className="slot-violation" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          No cumple tus restricciones: {slot.violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ')}
        </span>
      )}
      {!hasViolations && slot.unknownIngredients.length > 0 && (
        <span className="slot-unknown">Sin datos de alérgenos: {slot.unknownIngredients.join(', ')}</span>
      )}
    </button>
  );
}
