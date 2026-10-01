// Recipe form: write a recipe, edit one, or review an imported draft before saving.
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { DIFFICULTY_LABELS } from '../../constants/labels.js';
import ChipInput from '../profile/ChipInput.jsx';

/** Recipe (or import draft) → form state. Numbers become strings for the inputs. */
function toFormState(recipe = {}) {
  return {
    name: recipe.name ?? '',
    description: recipe.description ?? '',
    timeMinutes: recipe.timeMinutes ? String(recipe.timeMinutes) : '',
    servings: recipe.servings ? String(recipe.servings) : '',
    difficulty: recipe.difficulty ?? null,
    tags: recipe.tags ?? [],
    equipment: recipe.equipment ?? [],
    ingredients: recipe.ingredients?.length
      ? recipe.ingredients.map(({ name, quantityText, optional }) => ({ name, quantityText: quantityText ?? '', optional: Boolean(optional) }))
      : [{ name: '', quantityText: '', optional: false }],
    steps: recipe.steps?.length ? recipe.steps : [''],
    parentRecipeId: recipe.parentRecipeId ?? null,
    linkedProductName: recipe.linkedProductName ?? recipe.linkedProduct?.name ?? '',
    isFavorite: Boolean(recipe.isFavorite),
    source: recipe.source ?? 'user',
    sourceUrl: recipe.sourceUrl ?? null,
  };
}

/** Form state → API body. Empty rows are dropped. */
function toPayload(form) {
  const number = (text) => (text.trim() ? Number(text) : null);
  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    timeMinutes: number(form.timeMinutes),
    servings: number(form.servings),
    difficulty: form.difficulty,
    tags: form.tags,
    equipment: form.equipment,
    ingredients: form.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ name: i.name.trim(), quantityText: i.quantityText.trim() || null, optional: i.optional })),
    steps: form.steps.map((s) => s.trim()).filter(Boolean),
    parentRecipeId: form.parentRecipeId,
    linkedProductName: form.linkedProductName.trim() || null,
    isFavorite: form.isFavorite,
    source: form.source,
    sourceUrl: form.sourceUrl,
  };
}

/**
 * @param {{ initial?: object, recipeId?: number, submitLabel: string, onSubmit: (payload) => Promise<void> }} props
 */
export default function RecipeForm({ initial, recipeId, submitLabel, onSubmit }) {
  const [form, setForm] = useState(() => toFormState(initial));
  const [recipes, setRecipes] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/recipes').then((list) => setRecipes(list.filter((r) => r.id !== recipeId))).catch(() => {});
  }, [recipeId]);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateRow = (field, index, changes) =>
    setForm((current) => ({ ...current, [field]: current[field].map((row, i) => (i === index ? (typeof row === 'string' ? changes : { ...row, ...changes }) : row)) }));
  const removeRow = (field, index) => setForm((current) => ({ ...current, [field]: current[field].filter((_, i) => i !== index) }));

  async function handleSubmit(event) {
    event.preventDefault();
    const payload = toPayload(form);
    if (payload.ingredients.length === 0) {
      setError('Añade al menos un ingrediente.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="recipe-form">
      <label className="field">
        <span className="field-label">Nombre</span>
        <input className="input" value={form.name} maxLength={120} required onChange={(e) => update('name', e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Descripción corta (opcional)</span>
        <input className="input" value={form.description} maxLength={500} onChange={(e) => update('description', e.target.value)} />
      </label>
      <div className="field-row">
        <label className="field">
          <span className="field-label">Minutos</span>
          <input className="input" type="number" inputMode="numeric" min={1} max={1440} value={form.timeMinutes} onChange={(e) => update('timeMinutes', e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Raciones</span>
          <input className="input" type="number" inputMode="numeric" min={1} max={50} value={form.servings} onChange={(e) => update('servings', e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span className="field-label">Dificultad</span>
        <div className="segmented" role="group" aria-label="Dificultad">
          {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={form.difficulty === value} onClick={() => update('difficulty', form.difficulty === value ? null : value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <fieldset className="form-section plain-fieldset">
        <legend className="field-label">Ingredientes</legend>
        {form.ingredients.map((ingredient, index) => (
          <div key={index} className="ingredient-row">
            <input
              className="input"
              aria-label={`Ingrediente ${index + 1}`}
              placeholder="Ingrediente"
              value={ingredient.name}
              maxLength={120}
              onChange={(e) => updateRow('ingredients', index, { name: e.target.value })}
            />
            <input
              className="input quantity"
              aria-label={`Cantidad del ingrediente ${index + 1}`}
              placeholder="Cantidad"
              value={ingredient.quantityText}
              maxLength={60}
              onChange={(e) => updateRow('ingredients', index, { quantityText: e.target.value })}
            />
            <button type="button" className="icon-button" onClick={() => removeRow('ingredients', index)} aria-label={`Quitar ingrediente ${index + 1}`}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="link-button" onClick={() => update('ingredients', [...form.ingredients, { name: '', quantityText: '', optional: false }])}>
          <Plus size={16} aria-hidden="true" /> Añadir ingrediente
        </button>
      </fieldset>

      <fieldset className="form-section plain-fieldset">
        <legend className="field-label">Pasos</legend>
        {form.steps.map((step, index) => (
          <div key={index} className="step-row">
            <span className="step-number">{index + 1}</span>
            <textarea
              className="input"
              rows={2}
              aria-label={`Paso ${index + 1}`}
              value={step}
              maxLength={1000}
              onChange={(e) => updateRow('steps', index, e.target.value)}
            />
            <button type="button" className="icon-button" onClick={() => removeRow('steps', index)} aria-label={`Quitar paso ${index + 1}`}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="link-button" onClick={() => update('steps', [...form.steps, ''])}>
          <Plus size={16} aria-hidden="true" /> Añadir paso
        </button>
      </fieldset>

      <ChipInput label="Etiquetas" values={form.tags} onChange={(v) => update('tags', v)} placeholder="Ej.: rápida, batch, japonesa" />

      <label className="field">
        <span className="field-label">Es una variación de… (opcional)</span>
        <select
          className="input"
          value={form.parentRecipeId ?? ''}
          onChange={(e) => update('parentRecipeId', e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">No, es una receta propia</option>
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field-label">Producto con el que la haces (opcional)</span>
        <input
          className="input"
          value={form.linkedProductName}
          maxLength={120}
          placeholder="Ej.: Yatekomo"
          onChange={(e) => update('linkedProductName', e.target.value)}
        />
        <span className="muted small">Si lo tienes en casa, el menú propondrá esta receta en vez del producto tal cual.</span>
      </label>

      <label className="checkbox-row">
        <input type="checkbox" checked={form.isFavorite} onChange={(e) => update('isFavorite', e.target.checked)} />
        Favorita
      </label>

      {error && <p className="notice error">{error}</p>}
      <button type="submit" className="button full" disabled={saving || !form.name.trim()}>
        {saving ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}
