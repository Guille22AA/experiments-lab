// Confirmation card for something the assistant proposes. Nothing changes
// until "Aceptar"; once applied it can be undone.
import { AlertTriangle, Check, Undo2, X } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { announceDataChanged } from '../../hooks/useDataChanged.js';

const STATUS_TEXT = { accepted: 'Hecho', rejected: 'Descartado', undone: 'Deshecho', failed: 'No se ha podido hacer' };

export default function ActionCard({ action, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function run(verb) {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.post(`/chat/actions/${action.id}/${verb}`));
      if (verb !== 'reject') announceDataChanged();
    } catch (err) {
      setError(err.message);
      if (err.status === 409) onChange({ ...action, status: 'failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`action-card status-${action.status}`} role="group" aria-label="Propuesta del asistente">
      <p className="action-summary">{action.summary}</p>
      {action.warnings.map((warning) => (
        <p key={warning} className="action-warning">
          <AlertTriangle size={14} aria-hidden="true" /> {warning}
        </p>
      ))}

      {action.status === 'proposed' ? (
        <div className="button-row">
          <button type="button" className="button" onClick={() => run('accept')} disabled={busy}>
            <Check size={18} aria-hidden="true" /> Aceptar
          </button>
          <button type="button" className="button secondary" onClick={() => run('reject')} disabled={busy}>
            <X size={18} aria-hidden="true" /> Rechazar
          </button>
        </div>
      ) : (
        <div className="action-status">
          <span>{STATUS_TEXT[action.status]}</span>
          {action.status === 'accepted' && (
            <button type="button" className="link-button" onClick={() => run('undo')} disabled={busy}>
              <Undo2 size={16} aria-hidden="true" /> Deshacer
            </button>
          )}
        </div>
      )}
      {error && <p className="action-warning">{error}</p>}
    </div>
  );
}
