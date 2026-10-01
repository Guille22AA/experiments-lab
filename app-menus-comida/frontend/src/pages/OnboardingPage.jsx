// First-run interview: chat with the assistant, then review the profile it built.
// Without AI (no key, limit reached...) the profile can be filled in by hand.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import Composer from '../components/assistant/Composer.jsx';
import MessageList from '../components/assistant/MessageList.jsx';
import ProfileForm from '../components/profile/ProfileForm.jsx';
import { useProfile } from '../context/ProfileContext.jsx';

export default function OnboardingPage() {
  const { profile, setProfile } = useProfile();
  const navigate = useNavigate();
  const isRedo = Boolean(profile.onboardingCompletedAt);

  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(null); // profile proposed by the AI at the end
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [mode, setMode] = useState('chat'); // 'chat' | 'review'

  useEffect(() => {
    api
      .get('/onboarding')
      .then((conversation) => {
        setMessages(conversation.messages);
        setDraft(conversation.draft);
        if (conversation.draft) setMode('review');
      })
      .catch((err) => setError(err.message));
    api
      .get('/health')
      .then((health) => setAiConfigured(health.ai.configured))
      .catch(() => {});
  }, []);

  async function send(text) {
    setError(null);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', content: text }]);
    setPending(true);
    try {
      const conversation = await api.post('/onboarding/messages', { message: text });
      setMessages(conversation.messages);
      if (conversation.draft) {
        setDraft(conversation.draft);
        setMode('review');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  async function confirmProfile(form) {
    const saved = await api.put('/profile', { ...form, completeOnboarding: true });
    setProfile(saved);
    navigate('/menu', { replace: true });
  }

  return (
    <div className="onboarding">
      <header className="app-header">
        <h1>{mode === 'review' ? 'Revisa tu perfil' : 'Conozcámonos'}</h1>
        {isRedo && (
          <button className="link-button" onClick={() => navigate('/ajustes')}>
            Cancelar
          </button>
        )}
      </header>

      {mode === 'review' ? (
        <div className="onboarding-body">
          <div className="onboarding-review">
            <p className="muted">
              {draft
                ? 'Esto es lo que he entendido. Corrige lo que quieras y guárdalo.'
                : 'Rellena tu perfil. Podrás cambiarlo cuando quieras desde Ajustes.'}
            </p>
            <ProfileForm
              key={draft ? 'draft' : 'manual'}
              initialProfile={draft ?? profile}
              submitLabel="Guardar y empezar"
              onSubmit={confirmProfile}
            />
            <div className="onboarding-footer">
              <button className="link-button" onClick={() => setMode('chat')}>
                Volver a la conversación
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="onboarding-body">
            {!aiConfigured && (
              <p className="notice" style={{ margin: 16 }}>
                El asistente no está configurado todavía (falta la clave de la IA en el servidor). Puedes rellenar tu
                perfil a mano.
              </p>
            )}
            <MessageList messages={messages} pending={pending} error={error} />
          </div>
          <div className="onboarding-footer">
            <button className="link-button" onClick={() => setMode('review')}>
              {draft ? 'Ver el resumen del perfil' : 'Prefiero rellenarlo a mano'}
            </button>
          </div>
          <Composer onSend={send} disabled={pending || !aiConfigured} placeholder="Escribe tu respuesta…" />
        </>
      )}
    </div>
  );
}
