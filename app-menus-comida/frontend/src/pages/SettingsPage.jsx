import { RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import ProfileForm from '../components/profile/ProfileForm.jsx';
import { THEME_LABELS } from '../constants/labels.js';
import { useProfile } from '../context/ProfileContext.jsx';

export default function SettingsPage() {
  const { profile, setProfile, setTheme } = useProfile();
  const navigate = useNavigate();

  async function saveProfile(form) {
    const saved = await api.put('/profile', form);
    setProfile(saved);
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
        <ProfileForm initialProfile={profile} submitLabel="Guardar cambios" onSubmit={saveProfile} />
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
