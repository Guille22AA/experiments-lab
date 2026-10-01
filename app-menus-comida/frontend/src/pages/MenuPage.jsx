// Menu of the shopping cycle: generate it, review the proposal, then manage it day by day.
import { CalendarDays, Minus, Plus, ShoppingCart, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import DeductionSheet from '../components/menu/DeductionSheet.jsx';
import MenuDays from '../components/menu/MenuDays.jsx';
import SlotSheet from '../components/menu/SlotSheet.jsx';
import CycleCard from '../components/pantry/CycleCard.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { todayIso } from '../lib/dates.js';

const MAX_DAYS = 14;

/** Small "- 7 días +" control. */
function DaysStepper({ days, onChange }) {
  return (
    <div className="stepper" role="group" aria-label="Número de días">
      <button type="button" className="icon-button" onClick={() => onChange(Math.max(1, days - 1))} aria-label="Un día menos">
        <Minus size={20} aria-hidden="true" />
      </button>
      <span aria-live="polite">
        {days} {days === 1 ? 'día' : 'días'}
      </span>
      <button type="button" className="icon-button" onClick={() => onChange(Math.min(MAX_DAYS, days + 1))} aria-label="Un día más">
        <Plus size={20} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * What the menu needs and is not at home. `onAddToList` is only given for the
 * active menu (a draft is not decided yet).
 */
function ShoppingSuggestions({ suggestions, onAddToList }) {
  if (suggestions.length === 0) return null;
  return (
    <section className="card">
      <h2>
        <ShoppingCart size={20} aria-hidden="true" /> Te falta comprar
      </h2>
      <ul className="suggestion-list">
        {suggestions.map((s, index) => (
          <li key={index}>
            <strong>{s.name}</strong>
            {s.quantity && <span className="muted"> · {s.quantity}</span>}
            {s.reason && <span className="muted small"> — {s.reason}</span>}
          </li>
        ))}
      </ul>
      {onAddToList ? (
        <button type="button" className="button secondary full" onClick={onAddToList}>
          <ShoppingCart size={18} aria-hidden="true" /> Añadir a la lista de la compra
        </button>
      ) : (
        <p className="muted small">Cuando aceptes el menú podrás pasarlo a la lista de la compra.</p>
      )}
    </section>
  );
}

export default function MenuPage() {
  const showToast = useToast();
  const navigate = useNavigate();
  const [state, setState] = useState(null); // { active, draft, cycleStatus, suggestedDays }
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(null); // text shown while the AI works
  const [error, setError] = useState(null);
  const [openSlot, setOpenSlot] = useState(null);
  const [deduction, setDeduction] = useState(null);

  const applyState = useCallback((next) => {
    setState(next);
    setDays(next.suggestedDays);
  }, []);

  const load = useCallback(() => api.get('/menus/current').then(applyState).catch((err) => setError(err.message)), [applyState]);

  useEffect(() => {
    load();
  }, [load]);

  /** Runs an action that may call the AI, with a clear loading message. */
  async function run(message, action) {
    setError(null);
    setBusy(message);
    try {
      applyState(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  const generate = () => run('Pensando tu menú… puede tardar medio minuto.', () => api.post('/menus/generate', { days }));
  const accept = () => run('Guardando…', () => api.post(`/menus/${state.draft.menu.id}/accept`));
  const discard = () => run('Descartando…', () => api.delete(`/menus/${state.draft.menu.id}`));

  async function addSuggestionsToList() {
    try {
      const { added, total } = await api.post('/shopping-list/from-menu', { menuId: state.active.menu.id });
      const text = added === 0 ? 'Ya estaba todo en la lista' : `${added} de ${total} productos añadidos a la lista`;
      showToast(text, { actionLabel: 'Ver lista', onAction: () => navigate('/lista') });
    } catch (err) {
      showToast(err.message);
    }
  }
  const extend = (extraDays) =>
    run('Estirando el menú con lo que queda en casa…', () => api.post('/menus/current/extend', { days: extraDays }));

  if (error && !state) return <p className="notice error">{error}</p>;
  if (!state) return <p className="muted">Cargando…</p>;

  const { active, draft, cycleStatus } = state;
  const shown = draft ?? active;
  const menuIsOver = active && !draft && active.menu.endDate < todayIso();

  return (
    <>
      {busy && (
        <div className="busy-overlay" role="status">
          <Sparkles size={32} aria-hidden="true" />
          <p>{busy}</p>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      {!shown && (
        <>
          <CycleCard status={cycleStatus} showButton={!cycleStatus.cycle} />
          <section className="card generate-card">
            <CalendarDays size={40} aria-hidden="true" />
            <h2>{cycleStatus.cycle ? '¿Te propongo un menú?' : 'También puedes pedir un menú ya'}</h2>
            <p className="muted">Lo haré con lo que tienes en la despensa, tus gustos y el tiempo que tienes cada día.</p>
            <DaysStepper days={days} onChange={setDays} />
            <button type="button" className="button full" onClick={generate}>
              <Sparkles size={18} aria-hidden="true" /> Proponer menú
            </button>
          </section>
        </>
      )}

      {draft && (
        <section className="card draft-banner">
          <h2>Propuesta de menú</h2>
          <p className="muted">Toca un plato para ver la receta. Si te convence, acéptalo y podrás cambiar platos sueltos.</p>
          <button type="button" className="button full" onClick={accept}>
            Aceptar menú
          </button>
          <div className="button-row">
            <button type="button" className="button secondary" onClick={generate}>
              Proponer otro
            </button>
            <button type="button" className="button secondary" onClick={discard}>
              Descartar
            </button>
          </div>
        </section>
      )}

      {menuIsOver && (
        <section className="card notice-card">
          <p>
            <strong>Se ha acabado el menú</strong> y aún no has registrado la compra. ¿Lo estiro con lo que queda en casa?
          </p>
          <div className="button-row">
            <button type="button" className="button secondary" onClick={() => extend(2)}>
              2 días más
            </button>
            <button type="button" className="button secondary" onClick={() => extend(3)}>
              3 días más
            </button>
          </div>
        </section>
      )}

      {shown && (
        <>
          <MenuDays view={shown} onOpenSlot={setOpenSlot} />
          <ShoppingSuggestions suggestions={shown.menu.shoppingSuggestions} onAddToList={draft ? null : addSuggestionsToList} />
        </>
      )}

      {active && !draft && (
        <section className="card new-menu-card">
          <p className="muted small">¿Quieres empezar de cero?</p>
          <DaysStepper days={days} onChange={setDays} />
          <button type="button" className="button secondary full" onClick={generate}>
            Proponer un menú nuevo
          </button>
        </section>
      )}

      {openSlot && (
        <SlotSheet
          slot={openSlot}
          view={shown}
          editable={!draft}
          onStateChange={applyState}
          onSlotChange={load}
          onCooked={setDeduction}
          onClose={() => setOpenSlot(null)}
        />
      )}
      {deduction && (
        <DeductionSheet
          proposals={deduction}
          onDone={(count) => {
            setDeduction(null);
            if (count > 0) showToast('Despensa actualizada');
          }}
          onClose={() => setDeduction(null)}
        />
      )}
    </>
  );
}
