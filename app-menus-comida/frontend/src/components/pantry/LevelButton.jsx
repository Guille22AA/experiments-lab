// Pantry level shown as a pill with 3 bars. Tapping it moves to the next level.
import { LEVEL_LABELS, NEXT_LEVEL } from '../../constants/labels.js';

const BARS = { empty: 0, low: 1, medium: 2, high: 3 };

export default function LevelButton({ level, onChange, productName }) {
  return (
    <button
      type="button"
      className={`level-button level-${level}`}
      onClick={() => onChange(NEXT_LEVEL[level])}
      aria-label={`${productName}: ${LEVEL_LABELS[level]}. Tocar para cambiar a ${LEVEL_LABELS[NEXT_LEVEL[level]]}`}
    >
      <span className="level-bars" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span key={bar} className={bar <= BARS[level] ? 'on' : ''} />
        ))}
      </span>
      {LEVEL_LABELS[level]}
    </button>
  );
}
