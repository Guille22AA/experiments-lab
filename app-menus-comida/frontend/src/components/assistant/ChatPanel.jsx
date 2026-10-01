// Assistant chat: full screen on mobile, side panel on desktop.
// It knows which screen it was opened from and sends that as context.
import { Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client.js';
import { SCREENS } from '../../constants/labels.js';
import Composer from './Composer.jsx';
import MessageList from './MessageList.jsx';

export default function ChatPanel({ onClose }) {
  const { pathname } = useLocation();
  const screen = SCREENS[pathname];

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

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function send(text) {
    setError(null);
    // Show the question straight away (temporary id until the server answers).
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', content: text }]);
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

  async function clearConversation() {
    if (!window.confirm('¿Borrar toda la conversación con el asistente?')) return;
    await api.delete('/chat');
    setMessages([]);
    setError(null);
  }

  return (
    <section className="chat-panel" role="dialog" aria-modal="true" aria-label="Asistente">
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
        <p className="notice" style={{ margin: 16 }}>
          El asistente no está configurado todavía (falta la clave de la IA en el servidor). El resto de la app funciona
          igual.
        </p>
      )}
      {messages.length === 0 && !pending && aiConfigured && (
        <p className="muted" style={{ padding: '16px 16px 0' }}>
          Pregúntame lo que quieras: dudas de cocina, sustituciones, ideas para comer…
        </p>
      )}

      <MessageList messages={messages} pending={pending} error={error} />
      <Composer onSend={send} disabled={pending || !aiConfigured} />
    </section>
  );
}
