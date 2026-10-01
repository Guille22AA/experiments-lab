// Add a recipe by telling it informally or from a web link.
// The result always goes to the review form; nothing is saved here.
import { Link2, MessageSquareText, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import Sheet from '../ui/Sheet.jsx';

export default function ImportSheet({ onClose }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState('text'); // text | url
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(null); // result with questions to answer
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const review = (result) => navigate('/recetas/nueva', { state: { draft: result.draft, check: result.check, method: result.method } });

  async function call(action) {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result.questions.length > 0) {
        setPending(result);
        setAnswers(result.questions.map(() => ''));
      } else {
        review(result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const fromText = () => call(() => api.post('/recipes/import/text', { text }));
  const fromUrl = () => call(() => api.post('/recipes/import/url', { url }));
  const withAnswers = () =>
    call(() =>
      api.post('/recipes/import/text', {
        text,
        answers: pending.questions.map((question, i) => ({ question, answer: answers[i] })),
      }),
    );

  return (
    <Sheet title="Añadir una receta" onClose={onClose}>
      {pending ? (
        <>
          <p>Para apuntarla bien, solo me falta esto:</p>
          {pending.questions.map((question, index) => (
            <label key={question} className="field">
              <span className="field-label">{question}</span>
              <input
                className="input"
                value={answers[index]}
                maxLength={500}
                onChange={(e) => setAnswers((current) => current.map((a, i) => (i === index ? e.target.value : a)))}
              />
            </label>
          ))}
          {error && <p className="notice error">{error}</p>}
          <button type="button" className="button full" onClick={withAnswers} disabled={busy || answers.every((a) => !a.trim())}>
            {busy ? 'Apuntando…' : 'Seguir'}
          </button>
          <button type="button" className="link-button" onClick={() => review(pending)}>
            Saltar y revisarla tal cual
          </button>
        </>
      ) : (
        <>
          <div className="segmented" role="group" aria-label="Cómo añadirla">
            <button type="button" aria-pressed={mode === 'text'} onClick={() => setMode('text')}>
              <MessageSquareText size={16} aria-hidden="true" /> Contándola
            </button>
            <button type="button" aria-pressed={mode === 'url'} onClick={() => setMode('url')}>
              <Link2 size={16} aria-hidden="true" /> Enlace web
            </button>
          </div>

          {mode === 'text' ? (
            <label className="field import-field">
              <span className="field-label">Cuéntamela como quieras</span>
              <textarea
                className="input"
                rows={6}
                value={text}
                maxLength={5000}
                placeholder="Ej.: con los yatekomos me hago un ramen con soja texturizada y salsa teriyaki… También puedes pegar una receta o lo que viste en un vídeo. Si es una versión de otra receta tuya, dímelo."
                onChange={(e) => setText(e.target.value)}
              />
            </label>
          ) : (
            <label className="field import-field">
              <span className="field-label">Enlace a la receta</span>
              <input className="input" type="url" inputMode="url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
              <span className="muted small">Los vídeos (YouTube, TikTok, Instagram…) no se pueden importar: cuéntamela en la otra pestaña.</span>
            </label>
          )}

          {error && <p className="notice error">{error}</p>}
          <button
            type="button"
            className="button full"
            onClick={mode === 'text' ? fromText : fromUrl}
            disabled={busy || (mode === 'text' ? text.trim().length < 10 : !url.trim())}
          >
            <Sparkles size={18} aria-hidden="true" /> {busy ? 'Leyendo… (unos segundos)' : 'Convertir en receta'}
          </button>
        </>
      )}
    </Sheet>
  );
}
