// Profile form, used in Settings and to review the profile after the interview.
// It only edits a local copy; `onSubmit(profile)` receives the result.
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { EQUIPMENT_LABELS, MEAL_TYPE_LABELS, MOTIVATION_LABELS, SKILL_LABELS } from '../../constants/labels.js';
import ChipInput from './ChipInput.jsx';

/** Only the fields the backend accepts on PUT /api/profile. */
function toEditable(profile) {
  return {
    peopleCount: profile.peopleCount ?? 1,
    mealsToPlan: profile.mealsToPlan ?? ['lunch', 'dinner'],
    cookingMotivation: profile.cookingMotivation ?? 'medium',
    weekdayMinutes: profile.weekdayMinutes ?? 30,
    weekendMinutes: profile.weekendMinutes ?? 60,
    skillLevel: profile.skillLevel ?? 'intermediate',
    equipment: profile.equipment ?? [],
    likes: profile.likes ?? [],
    dislikes: profile.dislikes ?? [],
    batchCooking: profile.batchCooking ?? false,
    usesLeftovers: profile.usesLeftovers ?? true,
    shoppingFrequencyDays: profile.shoppingFrequencyDays ?? 7,
    extraNotes: profile.extraNotes ?? [],
    restrictions: (profile.restrictions ?? []).map(({ code, label, note }) => ({ code, label, note })),
  };
}

/** Adds or removes `value` from an array. */
const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export default function ProfileForm({ initialProfile, submitLabel, onSubmit }) {
  const [form, setForm] = useState(() => toEditable(initialProfile));
  const [catalog, setCatalog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'error', text }

  useEffect(() => {
    api.get('/profile/restriction-catalog').then(setCatalog).catch(() => setCatalog([]));
  }, []);

  const update = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  // Restrictions are split into catalog ones (checkboxes) and free-text "other" ones (chips).
  const knownCodes = form.restrictions.filter((r) => r.code !== 'other').map((r) => r.code);
  const otherLabels = form.restrictions.filter((r) => r.code === 'other').map((r) => r.label);

  function toggleRestriction(code) {
    const exists = knownCodes.includes(code);
    update('restrictions', exists ? form.restrictions.filter((r) => r.code !== code) : [...form.restrictions, { code }]);
  }

  function setOtherRestrictions(labels) {
    const known = form.restrictions.filter((r) => r.code !== 'other');
    update('restrictions', [...known, ...labels.map((label) => ({ code: 'other', label }))]);
  }

  const numberField = (field) => ({
    type: 'number',
    inputMode: 'numeric',
    className: 'input',
    value: form[field],
    onChange: (event) => update(field, Number(event.target.value)),
  });

  async function handleSubmit(event) {
    event.preventDefault();
    if (form.mealsToPlan.length === 0) {
      setMessage({ type: 'error', text: 'Elige al menos una comida para planificar.' });
      return;
    }
    setSaving(true);
    try {
      await onSubmit(form);
      setMessage({ type: 'ok', text: 'Guardado.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <section className="form-section">
        <h3>Restricciones y alergias</h3>
        <div className="chip-group" role="group" aria-label="Restricciones">
          {catalog.map((item) => (
            <button
              key={item.code}
              type="button"
              className="chip"
              aria-pressed={knownCodes.includes(item.code)}
              onClick={() => toggleRestriction(item.code)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <ChipInput
          label="Otras (escríbelas)"
          values={otherLabels}
          onChange={setOtherRestrictions}
          placeholder="Ej.: alergia al kiwi"
        />
      </section>

      <section className="form-section">
        <h3>Gustos</h3>
        <ChipInput label="Me gusta" values={form.likes} onChange={(v) => update('likes', v)} placeholder="Ej.: ramen, legumbres" />
        <ChipInput label="No me gusta" values={form.dislikes} onChange={(v) => update('dislikes', v)} placeholder="Ej.: pescado" />
      </section>

      <section className="form-section">
        <h3>Qué planificar</h3>
        <div className="field">
          <span className="field-label">Comidas</span>
          <div className="chip-group" role="group" aria-label="Comidas a planificar">
            {Object.entries(MEAL_TYPE_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={form.mealsToPlan.includes(value)}
                onClick={() => update('mealsToPlan', toggle(form.mealsToPlan, value))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Personas</span>
            <input {...numberField('peopleCount')} min={1} max={20} required />
          </label>
          <label className="field">
            <span className="field-label">Compro cada (días)</span>
            <input {...numberField('shoppingFrequencyDays')} min={1} max={31} required />
          </label>
        </div>
      </section>

      <section className="form-section">
        <h3>Cocina y tiempo</h3>
        <div className="field">
          <span className="field-label">Ganas de cocinar</span>
          <div className="segmented" role="group" aria-label="Ganas de cocinar">
            {Object.entries(MOTIVATION_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.cookingMotivation === value}
                onClick={() => update('cookingMotivation', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Minutos entre semana</span>
            <input {...numberField('weekdayMinutes')} min={5} max={300} required />
          </label>
          <label className="field">
            <span className="field-label">Minutos el finde</span>
            <input {...numberField('weekendMinutes')} min={5} max={480} required />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Nivel en la cocina</span>
          <div className="segmented" role="group" aria-label="Nivel en la cocina">
            {Object.entries(SKILL_LABELS).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={form.skillLevel === value} onClick={() => update('skillLevel', value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="field-label">Utensilios</span>
          <div className="chip-group" role="group" aria-label="Utensilios">
            {Object.entries(EQUIPMENT_LABELS).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="chip"
                aria-pressed={form.equipment.includes(value)}
                onClick={() => update('equipment', toggle(form.equipment, value))}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.batchCooking} onChange={(e) => update('batchCooking', e.target.checked)} />
          Me interesa cocinar en tandas (batch cooking)
        </label>
        <label className="checkbox-row">
          <input type="checkbox" checked={form.usesLeftovers} onChange={(e) => update('usesLeftovers', e.target.checked)} />
          Aprovechar sobras de otros días
        </label>
      </section>

      <section className="form-section">
        <ChipInput
          label="Otras notas para el asistente"
          values={form.extraNotes}
          onChange={(v) => update('extraNotes', v)}
          placeholder="Ej.: los lunes como fuera"
        />
      </section>

      {message && (
        <p className={`notice ${message.type}`} role="status">
          {message.text}
        </p>
      )}
      <button type="submit" className="button full" disabled={saving}>
        {saving ? 'Guardando…' : submitLabel}
      </button>
    </form>
  );
}
