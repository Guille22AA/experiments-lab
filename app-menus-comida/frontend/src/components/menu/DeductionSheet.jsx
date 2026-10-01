// After cooking: "¿Has gastado esto?" — proposes lowering the pantry products used.
// Nothing changes until the user confirms.
import { useState } from 'react';
import { api } from '../../api/client.js';
import { LEVEL_LABELS } from '../../constants/labels.js';
import Sheet from '../ui/Sheet.jsx';

export default function DeductionSheet({ proposals, onDone, onClose }) {
  const [selected, setSelected] = useState(() => new Set(proposals.map((p) => p.pantryItemId)));
  const [error, setError] = useState(null);

  const toggle = (id) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function confirm() {
    const changes = proposals.filter((p) => selected.has(p.pantryItemId)).map((p) => ({ id: p.pantryItemId, level: p.proposedLevel }));
    try {
      if (changes.length > 0) await api.post('/pantry/levels', { changes });
      onDone(changes.length);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Sheet title="¿Actualizo la despensa?" onClose={onClose}>
      <p className="muted">Esto es lo que has usado de casa. Desmarca lo que no quieras cambiar.</p>
      <ul className="deduction-list">
        {proposals.map((p) => (
          <li key={p.pantryItemId}>
            <label className="checkbox-row">
              <input type="checkbox" checked={selected.has(p.pantryItemId)} onChange={() => toggle(p.pantryItemId)} />
              <span>
                <strong>{p.name}</strong>
                <span className="muted small">
                  {' '}
                  {LEVEL_LABELS[p.currentLevel]} → {LEVEL_LABELS[p.proposedLevel]}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="notice error">{error}</p>}
      <button type="button" className="button full" onClick={confirm}>
        Actualizar despensa
      </button>
      <button type="button" className="button secondary full sheet-secondary" onClick={onClose}>
        No, déjalo como está
      </button>
    </Sheet>
  );
}
