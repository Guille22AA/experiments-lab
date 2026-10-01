// Detail of a menu dish: the recipe and what can be done with it
// (mark as cooked or skipped, change it for another dish, move it).
import { ArrowRightLeft, Check, MessageCircle, RefreshCw, SkipForward, Sparkles, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { MEAL_TYPE_LABELS } from '../../constants/labels.js';
import { useAssistant } from '../../context/AssistantContext.jsx';
import { dayLabel } from '../../lib/dates.js';
import RecipeBody from '../recipes/RecipeBody.jsx';
import Sheet from '../ui/Sheet.jsx';

/** Change the dish: AI alternatives or one of the saved recipes. */
function ChangeDish({ slot, onReplaced }) {
  const [request, setRequest] = useState('');
  const [alternatives, setAlternatives] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/recipes').then((list) => setRecipes(list.filter((r) => r.id !== slot.recipeId))).catch(() => {});
  }, [slot.recipeId]);

  async function askAi() {
    setError(null);
    setLoading(true);
    try {
      setAlternatives(await api.post(`/menus/slots/${slot.id}/alternatives`, request.trim() ? { request: request.trim() } : {}));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function choose(body) {
    setError(null);
    try {
      onReplaced(await api.post(`/menus/slots/${slot.id}/replace`, body));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <label className="field">
        <span className="field-label">¿Qué te apetece? (opcional)</span>
        <input className="input" value={request} maxLength={300} placeholder="Ej.: algo más rápido" onChange={(e) => setRequest(e.target.value)} />
      </label>
      <button type="button" className="button full" onClick={askAi} disabled={loading}>
        <Sparkles size={18} aria-hidden="true" /> {loading ? 'Pensando…' : 'Pedir 3 ideas'}
      </button>
      {error && <p className="notice error">{error}</p>}

      {alternatives && (
        <ul className="choice-list">
          {alternatives.map((dish) => (
            <li key={dish.key} className="card">
              <strong>{dish.name}</strong>
              {dish.timeMinutes && <span className="muted small"> · {dish.timeMinutes} min</span>}
              {dish.description && <p className="small">{dish.description}</p>}
              {dish.unknownIngredients?.length > 0 && <p className="muted small">Sin datos de alérgenos: {dish.unknownIngredients.join(', ')}</p>}
              <button type="button" className="button secondary full" onClick={() => choose({ dish })}>
                Elegir este
              </button>
            </li>
          ))}
        </ul>
      )}

      {recipes.length > 0 && (
        <>
          <h3>O elige una de tus recetas</h3>
          <ul className="choice-list compact">
            {recipes.map((recipe) => (
              <li key={recipe.id}>
                <button type="button" className="choice-row" onClick={() => choose({ recipeId: recipe.id })}>
                  {recipe.name}
                  {recipe.timeMinutes && <span className="muted small">{recipe.timeMinutes} min</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Move the dish to another day or meal (swaps if that place is taken). */
function MoveDish({ slot, view, onMoved }) {
  const [date, setDate] = useState(slot.date);
  const [mealType, setMealType] = useState(slot.mealType);
  const [error, setError] = useState(null);

  async function move() {
    try {
      onMoved(await api.post(`/menus/slots/${slot.id}/move`, { date, mealType }));
    } catch (err) {
      setError(err.message);
    }
  }

  const target = view.days.find((d) => d.date === date)?.slots.find((s) => s.mealType === mealType && s.id !== slot.id);
  return (
    <div>
      <label className="field">
        <span className="field-label">Día</span>
        <select className="input" value={date} onChange={(e) => setDate(e.target.value)}>
          {view.days.map((day) => (
            <option key={day.date} value={day.date}>
              {dayLabel(day.date)}
            </option>
          ))}
        </select>
      </label>
      <div className="field">
        <span className="field-label">Comida</span>
        <div className="segmented" role="group" aria-label="Comida">
          {view.mealTypes.map((m) => (
            <button key={m} type="button" aria-pressed={mealType === m} onClick={() => setMealType(m)}>
              {MEAL_TYPE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      {target && <p className="muted small">Se intercambiará con «{target.title}».</p>}
      {error && <p className="notice error">{error}</p>}
      <button type="button" className="button full" onClick={move} disabled={date === slot.date && mealType === slot.mealType}>
        Mover
      </button>
    </div>
  );
}

/**
 * @param {{ slot, view, editable: boolean, onStateChange: (state) => void, onSlotChange: () => void,
 *           onCooked: (result) => void, onClose: () => void }} props
 *   onCooked receives { recipeId, cookedLogId, isFirstTime, deduction } to ask for feedback
 *   editable = false for a draft (it can only be looked at until accepted)
 *   onStateChange receives the new menu state after change/move; onSlotChange asks to reload it
 */
export default function SlotSheet({ slot, view, editable, onStateChange, onSlotChange, onCooked, onClose }) {
  const [mode, setMode] = useState('detail'); // detail | change | move
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (slot.recipeId) api.get(`/recipes/${slot.recipeId}`).then(setRecipe).catch((err) => setError(err.message));
  }, [slot.recipeId]);

  async function setStatus(status) {
    setBusy(true);
    setError(null);
    try {
      const result = await api.patch(`/menus/slots/${slot.id}`, { status });
      onSlotChange();
      if (status === 'cooked' && (result.recipeId || result.deduction.length > 0)) onCooked({ ...result, title: slot.title });
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const done = (state) => {
    onStateChange(state);
    onClose();
  };

  const { openAssistant } = useAssistant();
  function askAssistant() {
    const label = `${MEAL_TYPE_LABELS[slot.mealType]} del ${dayLabel(slot.date).replace(/^(Hoy|Mañana) · /, '')}: ${slot.title}`;
    onClose();
    openAssistant({ name: 'menu_slot', label, slotId: slot.id });
  }

  const title = mode === 'change' ? 'Cambiar plato' : mode === 'move' ? 'Mover plato' : slot.title;
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted small sheet-subtitle">
        {MEAL_TYPE_LABELS[slot.mealType]} · {dayLabel(slot.date)}
      </p>

      {mode === 'detail' && (
        <>
          {recipe ? <RecipeBody recipe={recipe} /> : !error && <p className="muted">Cargando receta…</p>}
          {error && <p className="notice error">{error}</p>}

          {/* E.g. "no me queda X, ¿con qué lo sustituyo?" with this dish as context. */}
          <button type="button" className="link-button ask-assistant" onClick={askAssistant}>
            <MessageCircle size={16} aria-hidden="true" /> Preguntar al asistente sobre este plato
          </button>

          {editable && (
            <div className="sheet-actions">
              {slot.status === 'planned' ? (
                <>
                  <button type="button" className="button full" onClick={() => setStatus('cooked')} disabled={busy}>
                    <Check size={18} aria-hidden="true" /> {slot.isLeftover ? 'Ya me lo he comido' : 'Lo he cocinado'}
                  </button>
                  <div className="button-row">
                    <button type="button" className="button secondary" onClick={() => setMode('change')}>
                      <RefreshCw size={18} aria-hidden="true" /> Cambiar
                    </button>
                    <button type="button" className="button secondary" onClick={() => setMode('move')}>
                      <ArrowRightLeft size={18} aria-hidden="true" /> Mover
                    </button>
                    <button type="button" className="button secondary" onClick={() => setStatus('skipped')} disabled={busy}>
                      <SkipForward size={18} aria-hidden="true" /> Saltar
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" className="button secondary full" onClick={() => setStatus('planned')} disabled={busy}>
                  <Undo2 size={18} aria-hidden="true" /> Marcar como pendiente
                </button>
              )}
            </div>
          )}
        </>
      )}

      {mode === 'change' && <ChangeDish slot={slot} onReplaced={done} />}
      {mode === 'move' && <MoveDish slot={slot} view={view} onMoved={done} />}
      {mode !== 'detail' && (
        <button type="button" className="link-button" onClick={() => setMode('detail')}>
          Volver a la receta
        </button>
      )}
    </Sheet>
  );
}
