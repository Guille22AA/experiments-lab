import { RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import ActionHistory from '../components/assistant/ActionHistory.jsx';
import SecuritySettings from '../components/auth/SecuritySettings.jsx';
import ProfileForm from '../components/profile/ProfileForm.jsx';
import { THEME_LABELS } from '../constants/labels.js';
import { useProfile } from '../context/ProfileContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function SettingsPage() {
  const { profile, setProfile, setTheme } = useProfile();
  const navigate = useNavigate();
  const showToast = useToast();

  async function saveProfile(form) {
    const saved = await api.put('/profile', form);
    setProfile(saved);
    showToast('Perfil guardado');
  }

  async function redoInterview() {
    if (!window.confirm('¿Repetir la entrevista? Tu perfil actual se mantiene hasta que confirmes el nuevo.')) return;
    await api.post('/onboarding/reset');
    navigate('/bienvenida');
  }

  return (
    <>
      <section className="card">
        <h2>Apariencia</h2>
        <div className="segmented" role="group" aria-label="Tema">
          {Object.entries(THEME_LABELS).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={profile.theme === value} onClick={() => setTheme(value)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Tu perfil</h2>
        <p className="muted">El asistente usa estos datos para proponerte menús.</p>
        {/* key: if the assistant changes the profile, the form starts again from the new data */}
        <ProfileForm key={profile.updatedAt} initialProfile={profile} submitLabel="Guardar cambios" onSubmit={saveProfile} />
      </section>

      <section className="card">
        <h2>Cambios del asistente</h2>
        <p className="muted">Lo que has aceptado en el chat. Puedes deshacerlo.</p>
        <ActionHistory />
      </section>

      <section className="card">
        <h2>Seguridad</h2>
        <SecuritySettings />
      </section>

      <section className="card">
        <h2>Entrevista</h2>
        <p className="muted">Vuelve a hablar con el asistente para rehacer tu perfil desde cero.</p>
        <button className="button secondary full" onClick={redoInterview}>
          <RotateCcw size={18} aria-hidden="true" />
          Repetir la entrevista
        </button>
      </section>
    </>
  );
}
