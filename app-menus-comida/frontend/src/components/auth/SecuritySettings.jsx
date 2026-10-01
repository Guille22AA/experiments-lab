// Settings → Seguridad: change the password and log out of this device.
import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';

const MIN_LENGTH = 8;

export default function SecuritySettings() {
  const showToast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(event) {
    event.preventDefault();
    if (next.length < MIN_LENGTH) return setError(`La nueva contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
    if (next !== repeat) return setError('Las dos contraseñas nuevas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/password', { currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setRepeat('');
      showToast('Contraseña cambiada. Los demás dispositivos tendrán que volver a entrar.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    window.location.assign('/'); // back to the login screen
  }

  return (
    <>
      <form onSubmit={changePassword}>
        <label className="field">
          <span className="field-label">Contraseña actual</span>
          <input className="input" type="password" autoComplete="current-password" value={current} maxLength={200} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Nueva</span>
            <input className="input" type="password" autoComplete="new-password" value={next} maxLength={200} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Repítela</span>
            <input className="input" type="password" autoComplete="new-password" value={repeat} maxLength={200} onChange={(e) => setRepeat(e.target.value)} />
          </label>
        </div>
        {error && <p className="notice error">{error}</p>}
        <button type="submit" className="button secondary full" disabled={busy || !current || !next}>
          Cambiar contraseña
        </button>
      </form>
      <button type="button" className="button danger full section-gap" onClick={logout}>
        <LogOut size={18} aria-hidden="true" /> Cerrar sesión en este dispositivo
      </button>
    </>
  );
}
