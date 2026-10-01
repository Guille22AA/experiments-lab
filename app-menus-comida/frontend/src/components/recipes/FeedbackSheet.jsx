// "¿Qué tal te ha salido?" right after cooking. Quick options, no stars.
// The planner uses these answers when it proposes the next menus.
import { useState } from 'react';
import { api } from '../../api/client.js';
import { ADJUSTMENT_LABELS, VERDICT_LABELS } from '../../constants/labels.js';
import Sheet from '../ui/Sheet.jsx';

/**
 * @param {{ cooked: { recipeId, cookedLogId, isFirstTime, title? }, onDone: () => void }} props
 */
export default function FeedbackSheet({ cooked, onDone }) {
  const [verdict, setVerdict] = useState(null);
  const [adjustments, setAdjustments] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const toggleAdjustment = (value) =>
    setAdjustments((current) => (current.includes(value) ? current.filter((a) => a !== value) : [...current, value]));

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/recipes/${cooked.recipeId}/feedback`, {
        verdict,
        adjustments: verdict === 'adjust' ? adjustments : [],
        note: note.trim() || null,
        cookedLogId: cooked.cookedLogId,
      });
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Sheet title="¿Qué tal te ha salido?" onClose={onDone}>
      {cooked.title && <p className="muted sheet-subtitle">{cooked.title}</p>}
      {cooked.isFirstTime && <p className="badge first-time">¡Primera vez que la haces!</p>}

      <div className="verdict-options" role="radiogroup" aria-label="Valoración">
        {Object.entries(VERDICT_LABELS).map(([value, label]) => (
          <button key={value} type="button" role="radio" aria-checked={verdict === value} className={`verdict verdict-${value}`} onClick={() => setVerdict(value)}>
            {label}
          </button>
        ))}
      </div>

      {verdict === 'adjust' && (
        <div className="field">
          <span className="field-label">¿Qué cambiarías la próxima vez?</span>
          <div className="chip-group" role="group" aria-label="Ajustes">
            {Object.entries(ADJUSTMENT_LABELS).map(([value, label]) => (
              <button key={value} type="button" className="chip" aria-pressed={adjustments.includes(value)} onClick={() => toggleAdjustment(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {verdict && (
        <label className="field">
          <span className="field-label">Nota (opcional)</span>
          <input className="input" value={note} maxLength={500} placeholder="Ej.: con más ajo queda mejor" onChange={(e) => setNote(e.target.value)} />
        </label>
      )}

      {error && <p className="notice error">{error}</p>}
      <button
        type="button"
        className="button full"
        onClick={save}
        disabled={!verdict || saving || (verdict === 'adjust' && adjustments.length === 0)}
      >
        Guardar
      </button>
      <button type="button" className="link-button full-width" onClick={onDone}>
        Ahora no
      </button>
    </Sheet>
  );
}
