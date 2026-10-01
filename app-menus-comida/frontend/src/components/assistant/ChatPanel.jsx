// Assistant chat: full screen on mobile, side panel on desktop.
// It knows where it was opened from (a screen, or a specific dish/recipe) and
// sends that as context. Proposed changes appear as confirmation cards.
import { Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client.js';
import { screenFor } from '../../constants/labels.js';
import { useDialogFocus } from '../../hooks/useDialogFocus.js';
import ActionCard from './ActionCard.jsx';
import Composer from './Composer.jsx';
import MessageList from './MessageList.jsx';

/**
 * @param {{ onClose: () => void, context?: { name, label, slotId?, recipeId? } }} props
 *   context: given when opened from a specific item; otherwise the current screen is used
 */
export default function ChatPanel({ onClose, context }) {
  const { pathname } = useLocation();
  const screen = context ?? screenFor(pathname);

  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [aiConfigured, setAiConfigured] = useState(true);

  // Load the history and check that the AI is set up.
  useEffect(() => {
    api.get('/chat').then(setMessages).catch((err) => setError(err.message));
    api
      .get('/health')
      .then((health) => setAiConfigured(health.ai.configured))
      .catch(() => {});
  }, []);

  // Focus inside the panel, Escape closes it, focus returns to the button.
  const dialogRef = useDialogFocus(onClose);

  async function send(text) {
    setError(null);
    // Show the question straight away (temporary id until the server answers).
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', content: text, actions: [] }]);
    setPending(true);
    try {
      const reply = await api.post('/chat/messages', { message: text, screen });
      setMessages((current) => [...current, reply]);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  const replaceAction = (updated) =>
    setMessages((current) =>
      current.map((m) => (m.actions?.some((a) => a.id === updated.id) ? { ...m, actions: m.actions.map((a) => (a.id === updated.id ? updated : a)) } : m)),
    );

  async function clearConversation() {
    if (!window.confirm('¿Borrar toda la conversación con el asistente? Lo que ya hayas aceptado se queda.')) return;
    await api.delete('/chat');
    setMessages([]);
    setError(null);
  }

  return (
    <section ref={dialogRef} className="chat-panel" role="dialog" aria-modal="true" aria-label="Asistente" tabIndex={-1}>
      <header className="app-header">
        <h1>Asistente</h1>
        <div>
          {messages.length > 0 && (
            <button className="icon-button" onClick={clearConversation} aria-label="Borrar conversación">
              <Trash2 size={20} aria-hidden="true" />
            </button>
          )}
          <button className="icon-button" onClick={onClose} aria-label="Cerrar asistente">
            <X size={24} aria-hidden="true" />
          </button>
        </div>
      </header>
      {screen && <div className="chat-context">Abierto desde: {screen.label}</div>}

      {!aiConfigured && (
        <p className="notice chat-notice">
          El asistente no está configurado todavía (falta la clave de la IA en el servidor). El resto de la app funciona igual.
        </p>
      )}
      {messages.length === 0 && !pending && aiConfigured && (
        <p className="muted chat-hint">
          Pregúntame lo que quieras o pídeme cambios: «no me queda nata, ¿con qué lo sustituyo?», «cambia la cena del jueves por algo
          más rápido», «ya no me gusta el pescado», «añade huevos a la lista», «hoy me he hecho el ramen»… Los cambios te los dejo
          para que los confirmes.
        </p>
      )}

      <MessageList
        messages={messages}
        pending={pending}
        error={error}
        renderAfter={(message) =>
          message.actions?.length > 0 && (
            <div className="action-list">
              {message.actions.map((action) => (
                <ActionCard key={action.id} action={action} onChange={replaceAction} />
              ))}
            </div>
          )
        }
      />
      <Composer onSend={send} disabled={pending || !aiConfigured} />
    </section>
  );
}
