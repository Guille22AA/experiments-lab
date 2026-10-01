// What the assistant has changed (accepted cards), with the option to undo.
import { Undo2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { announceDataChanged, useDataChanged } from '../../hooks/useDataChanged.js';

const formatDate = (iso) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function ActionHistory() {
  const [actions, setActions] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(() => api.get('/chat/actions/history').then(setActions).catch((err) => setError(err.message)), []);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(load);

  async function undo(action) {
    setError(null);
    try {
      await api.post(`/chat/actions/${action.id}/undo`);
      announceDataChanged(); // also reloads this list
    } catch (err) {
      setError(err.message);
    }
  }

  if (!actions) return null;
  if (actions.length === 0) return <p className="muted">Todavía no has aceptado ningún cambio del asistente.</p>;

  return (
    <>
      {error && <p className="notice error">{error}</p>}
      <ul className="history-list">
        {actions.map((action) => (
          <li key={action.id} className={action.status === 'undone' ? 'is-undone' : ''}>
            <span className="history-summary">{action.summary.replace(/^¿|\?$/g, '')}</span>
            <span className="muted small">
              {formatDate(action.resolvedAt)}
              {action.status === 'undone' && ' · deshecho'}
            </span>
            {action.status === 'accepted' && (
              <button type="button" className="link-button" onClick={() => undo(action)}>
                <Undo2 size={16} aria-hidden="true" /> Deshacer
              </button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
