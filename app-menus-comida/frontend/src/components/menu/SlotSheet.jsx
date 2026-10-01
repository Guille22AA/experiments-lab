// Detail of a menu dish: the recipe and what can be done with it
// (mark as cooked or skipped, change it for another dish, move it).
import { AlertTriangle, ArrowRightLeft, Check, Clock, RefreshCw, SkipForward, Sparkles, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { MEAL_TYPE_LABELS } from '../../constants/labels.js';
import { dayLabel } from '../../lib/dates.js';
import Sheet from '../ui/Sheet.jsx';

const DIFFICULTY_LABELS = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };

function RecipeDetail({ recipe }) {
  const badIngredients = new Set(recipe.check.violations.map((v) => v.ingredient));
  return (
    <div className="recipe-detail">
      {recipe.description && <p>{recipe.description}</p>}
      <p className="recipe-facts muted small">
        {recipe.timeMinutes && (
          <span>
            <Clock size={14} aria-hidden="true" /> {recipe.timeMinutes} min
          </span>
        )}
        {recipe.difficulty && <span>{DIFFICULTY_LABELS[recipe.difficulty]}</span>}
        {recipe.servings && <span>{recipe.servings === 1 ? '1 ración' : `${recipe.servings} raciones`}</span>}
      </p>
      {recipe.check.violations.length > 0 && (
        <p className="notice error">
          <AlertTriangle size={16} aria-hidden="true" /> No cumple tus restricciones:{' '}
          {recipe.check.violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ')}
        </p>
      )}
      <h3>Ingredientes</h3>
      <ul className="ingredient-list">
        {recipe.ingredients.map((ingredient) => (
          <li key={ingredient.id} className={badIngredients.has(ingredient.name) ? 'is-bad' : ''}>
            {ingredient.name}
            {ingredient.quantityText && <span className="muted"> · {ingredient.quantityText}</span>}
            {ingredient.optional && <span className="muted"> (opcional)</span>}
          </li>
        ))}
      </ul>
      {recipe.check.unknown.length > 0 && (
        <p className="muted small">Sin datos de alérgenos: {recipe.check.unknown.join(', ')}. Revísalos si te importa.</p>
      )}
      <h3>Pasos</h3>
      <ol className="step-list">
        {recipe.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </div>
  );
}

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
 *           onCooked: (deduction) => void, onClose: () => void }} props
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
      if (status === 'cooked' && result.deduction.length > 0) onCooked(result.deduction);
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

  const title = mode === 'change' ? 'Cambiar plato' : mode === 'move' ? 'Mover plato' : slot.title;
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="muted small sheet-subtitle">
        {MEAL_TYPE_LABELS[slot.mealType]} · {dayLabel(slot.date)}
      </p>

      {mode === 'detail' && (
        <>
          {recipe ? <RecipeDetail recipe={recipe} /> : !error && <p className="muted">Cargando receta…</p>}
          {error && <p className="notice error">{error}</p>}

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
