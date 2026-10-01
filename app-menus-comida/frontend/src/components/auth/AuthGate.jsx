// Nothing of the app is shown until this device is logged in.
// First time: create the password. Afterwards: log in (once per device, it is remembered).
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const MIN_LENGTH = 8;

function PasswordInput({ id, label, value, onChange, autoComplete, autoFocus }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="password-input">
        <input
          id={id}
          className="input"
          type={visible ? 'text' : 'password'}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          maxLength={200}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="icon-button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function AuthScreen({ mode, onDone }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const isSetup = mode === 'setup';

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSetup && password.length < MIN_LENGTH) return setError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);
    if (isSetup && password !== repeat) return setError('Las dos contraseñas no coinciden.');
    setBusy(true);
    setError(null);
    try {
      await api.post(isSetup ? '/auth/setup' : '/auth/login', { password });
      onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="center-screen auth-screen">
      <img src="/icon.svg" alt="" width="72" height="72" />
      <h1>Despensa y menús</h1>
      <p className="muted">
        {isSetup
          ? 'Crea una contraseña para que solo tú puedas entrar. Cada dispositivo la recordará 90 días.'
          : 'Escribe tu contraseña para entrar.'}
      </p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <PasswordInput
          id="password"
          label={isSetup ? 'Nueva contraseña' : 'Contraseña'}
          value={password}
          onChange={setPassword}
          autoComplete={isSetup ? 'new-password' : 'current-password'}
          autoFocus
        />
        {isSetup && <PasswordInput id="repeat" label="Repítela" value={repeat} onChange={setRepeat} autoComplete="new-password" />}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="button full" disabled={busy || !password}>
          <Lock size={18} aria-hidden="true" /> {isSetup ? 'Crear contraseña y entrar' : 'Entrar'}
        </button>
      </form>
      {!isSetup && <p className="muted small">¿La has olvidado? En el PC de la app, ejecuta «npm run reset-password».</p>}
    </main>
  );
}

export default function AuthGate({ children }) {
  const [state, setState] = useState('loading'); // loading | setup | login | in | error
  const [error, setError] = useState(null);

  const check = useCallback(async () => {
    try {
      const status = await api.get('/auth/status');
      setState(status.authenticated ? 'in' : status.passwordSet ? 'login' : 'setup');
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    check();
    // Any request that finds the session expired sends the user back here.
    window.addEventListener('app-unauthorized', check);
    return () => window.removeEventListener('app-unauthorized', check);
  }, [check]);

  if (state === 'loading') {
    return (
      <div className="center-screen muted" role="status">
        Cargando…
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="center-screen">
        <p className="notice error">{error}</p>
        <button className="button" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    );
  }
  if (state === 'setup' || state === 'login') return <AuthScreen mode={state} onDone={() => setState('in')} />;
  return children;
}
