// Register a purchase: read the receipt with AI (or add products by hand),
// ALWAYS review the lines, then save. A normal purchase opens a new cycle.
import { AlertTriangle, Camera, CheckCircle2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ProductSearch from '../components/pantry/ProductSearch.jsx';
import { prepareTicketFile } from '../lib/files.js';

const todayIso = () => new Date().toLocaleDateString('sv-SE'); // "YYYY-MM-DD" in local time
let nextKey = 1; // keys for the review lines

/** "2026-09-28" → ISO datetime. Today = now; other days = noon (avoids timezone surprises). */
function toPurchaseDateTime(day) {
  return day === todayIso() ? new Date().toISOString() : new Date(`${day}T12:00:00`).toISOString();
}

export default function PurchasePage() {
  const fileInput = useRef(null);
  const [kind, setKind] = useState('main');
  const [day, setDay] = useState(todayIso());
  const [source, setSource] = useState('manual');
  const [lines, setLines] = useState([]);
  const [total, setTotal] = useState(null);
  const [sections, setSections] = useState([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // after saving

  useEffect(() => {
    api.get('/products/sections').then(setSections).catch(() => {});
  }, []);

  const updateLine = (key, changes) => setLines((current) => current.map((l) => (l.key === key ? { ...l, ...changes } : l)));
  const removeLine = (key) => setLines((current) => current.filter((l) => l.key !== key));

  async function readTicket(file) {
    setError(null);
    setReading(true);
    try {
      const payload = await prepareTicketFile(file);
      const ticket = await api.post('/purchases/ticket', { mimeType: payload.mimeType, base64: payload.base64 });
      setLines((current) => [...current, ...ticket.lines.map((line) => ({ ...line, key: nextKey++ }))]);
      setSource(payload.source);
      if (ticket.date) setDay(ticket.date);
      if (ticket.total != null) setTotal(ticket.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setReading(false);
      fileInput.current.value = ''; // allow choosing the same file again
    }
  }

  async function addManualLine(choice) {
    let sectionId = choice.sectionId ?? null;
    let isNew = !choice.productId;
    if (isNew) {
      // Same guess the backend will make, to show the section straight away.
      const guess = await api.get(`/products/guess?name=${encodeURIComponent(choice.name)}`).catch(() => null);
      sectionId = guess?.sectionId ?? null;
    }
    setLines((current) => [...current, { key: nextKey++, productId: choice.productId ?? null, name: choice.name, sectionId, isNew, hasTagData: true }]);
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const saved = await api.post('/purchases', {
        kind,
        purchasedAt: toPurchaseDateTime(day),
        source,
        totalPrice: total,
        items: lines.map(({ productId, name, sectionId, tags, rawText, quantityText, price }) => ({
          productId,
          name: name.trim(),
          sectionId: sectionId || null,
          tags,
          rawText,
          quantityText,
          price,
        })),
      });
      setResult(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    return (
      <div className="coming-soon">
        <CheckCircle2 size={48} aria-hidden="true" />
        <h2>Compra guardada</h2>
        <p>
          {result.itemCount} productos añadidos a la despensa.
          {result.openedCycle
            ? ` Empieza un ciclo nuevo de ${result.cycleStatus.cycle.plannedDays} días.`
            : ' Es una compra pequeña: el ciclo actual sigue igual.'}
        </p>
        <p className="muted">Pronto, aquí mismo, te propondré el menú para estos días.</p>
        <Link to="/despensa" className="button">
          Ver la despensa
        </Link>
      </div>
    );
  }

  const unnamed = lines.some((line) => !line.name.trim());

  return (
    <>
      <section className="card">
        <div className="segmented" role="group" aria-label="Tipo de compra">
          <button type="button" aria-pressed={kind === 'main'} onClick={() => setKind('main')}>
            Compra normal
          </button>
          <button type="button" aria-pressed={kind === 'extra'} onClick={() => setKind('extra')}>
            Compra pequeña
          </button>
        </div>
        <p className="muted small">
          {kind === 'main'
            ? 'La compra grande de siempre: empieza un ciclo nuevo hasta la siguiente.'
            : 'Algo suelto a mitad de semana: se suma a la despensa sin empezar ciclo.'}
        </p>
        <label className="field">
          <span className="field-label">Fecha</span>
          <input type="date" className="input" value={day} max={todayIso()} onChange={(e) => setDay(e.target.value)} required />
        </label>
      </section>

      <section className="card">
        <h2>Productos</h2>
        <input
          ref={fileInput}
          type="file"
          accept="image/*,application/pdf"
          className="visually-hidden"
          onChange={(e) => e.target.files[0] && readTicket(e.target.files[0])}
        />
        <button type="button" className="button secondary full" onClick={() => fileInput.current.click()} disabled={reading}>
          <Camera size={20} aria-hidden="true" />
          {reading ? 'Leyendo el ticket… (unos segundos)' : 'Subir ticket (foto o PDF)'}
        </button>
        <p className="muted small center">o añádelos a mano:</p>
        <ProductSearch onPick={addManualLine} placeholder="Añadir producto…" />

        {lines.length > 0 && (
          <>
            <p className="muted small">Revisa que todo esté bien antes de guardar.</p>
            <ul className="review-list">
              {lines.map((line) => (
                <li key={line.key} className="review-line">
                  <div className="review-line-top">
                    <label className="visually-hidden" htmlFor={`name-${line.key}`}>
                      Nombre del producto
                    </label>
                    <input
                      id={`name-${line.key}`}
                      className="input"
                      value={line.name}
                      maxLength={120}
                      // A renamed line is no longer the product the ticket matched: the backend matches it again by name.
                      onChange={(e) => updateLine(line.key, { name: e.target.value, productId: null })}
                    />
                    <button type="button" className="icon-button" onClick={() => removeLine(line.key)} aria-label={`Quitar ${line.name}`}>
                      <X size={20} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="review-line-meta">
                    <select
                      className="input"
                      aria-label={`Sección de ${line.name}`}
                      value={line.sectionId ?? ''}
                      onChange={(e) => updateLine(line.key, { sectionId: e.target.value ? Number(e.target.value) : null })}
                    >
                      <option value="">Sin sección</option>
                      {sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    {line.isNew && <span className="badge">Nuevo</span>}
                    {line.price != null && <span className="muted small">{line.price.toFixed(2)} €</span>}
                  </div>
                  {line.rawText && <p className="muted small raw-text">Ticket: {line.rawText}</p>}
                  {line.isNew && !line.hasTagData && (
                    <p className="warning-line">
                      <AlertTriangle size={16} aria-hidden="true" /> No sé qué alérgenos lleva: revísalo si te importa.
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {total != null && <p className="muted">Total del ticket: {total.toFixed(2)} €</p>}
          </>
        )}
      </section>

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="button full" onClick={save} disabled={saving || reading || lines.length === 0 || unnamed}>
        {saving ? 'Guardando…' : `Guardar compra (${lines.length} productos)`}
      </button>
    </>
  );
}
