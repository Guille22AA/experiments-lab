// Health info of a product from Open Food Facts: Nutri-Score, processing (NOVA),
// simple notes ("casi todo azúcar") and allergens. Loaded only when asked,
// because it calls an external service.
import { ExternalLink, HeartPulse } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api/client.js';

const NOVA_LABELS = { 1: 'Sin procesar', 2: 'Ingrediente culinario', 3: 'Procesado', 4: 'Ultraprocesado' };
const TAG_LABELS = {
  contains_gluten: 'gluten', contains_dairy: 'leche', contains_lactose: 'lactosa', contains_egg: 'huevo', contains_nuts: 'frutos secos',
  contains_peanuts: 'cacahuete', contains_soy: 'soja', contains_fish: 'pescado', contains_shellfish: 'marisco', contains_sesame: 'sésamo',
};

function NutriScore({ grade }) {
  if (!grade) return <span className="muted small">Sin Nutri-Score</span>;
  return (
    <span className={`nutriscore nutriscore-${grade}`} aria-label={`Nutri-Score ${grade.toUpperCase()}`}>
      {grade.toUpperCase()}
    </span>
  );
}

function ProductInfo({ info }) {
  const allergens = info.allergenTags.map((t) => TAG_LABELS[t]).filter(Boolean);
  const per100 = [
    info.per100.kcal != null && `${info.per100.kcal} kcal`,
    info.per100.sugars != null && `azúcares ${info.per100.sugars} g`,
    info.per100.fat != null && `grasas ${info.per100.fat} g`,
    info.per100.salt != null && `sal ${info.per100.salt} g`,
  ].filter(Boolean);

  return (
    <div className="product-info">
      <div className="product-info-head">
        <NutriScore grade={info.nutriscore} />
        <div>
          <strong>{info.name}</strong>
          {info.brand && <span className="muted"> · {info.brand}</span>}
          {info.nova && <p className="muted small">{NOVA_LABELS[info.nova]}</p>}
        </div>
      </div>
      <ul className="health-notes">
        {info.notes.map((note) => (
          <li key={note.text} className={`note-${note.tone}`}>
            {note.text}
          </li>
        ))}
      </ul>
      {per100.length > 0 && <p className="muted small">Por 100 g/ml: {per100.join(' · ')}</p>}
      {allergens.length > 0 && <p className="small">Alérgenos: {allergens.join(', ')}</p>}
      <a className="small" href={`https://es.openfoodfacts.org/producto/${info.barcode}`} target="_blank" rel="noreferrer">
        Ver en Open Food Facts <ExternalLink size={12} aria-hidden="true" />
      </a>
    </div>
  );
}

export default function ProductHealth({ productId }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [barcode, setBarcode] = useState('');

  async function run(action) {
    setLoading(true);
    setError(null);
    try {
      setHealth(await action());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const load = () => run(() => api.get(`/products/${productId}/health`));
  const link = (code) => run(() => api.post(`/products/${productId}/off-link`, { barcode: code }));
  const unlink = () =>
    run(async () => {
      await api.delete(`/products/${productId}/off-link`);
      return api.get(`/products/${productId}/health`);
    });

  if (!health) {
    return (
      <div className="product-health">
        <button type="button" className="button secondary full" onClick={load} disabled={loading}>
          <HeartPulse size={18} aria-hidden="true" /> {loading ? 'Buscando…' : '¿Es sano? (Open Food Facts)'}
        </button>
        {error && <p className="notice error">{error}</p>}
      </div>
    );
  }

  return (
    <section className="product-health">
      <h3>Información saludable</h3>
      {health.linked ? (
        <>
          <ProductInfo info={health.linked} />
          <button type="button" className="link-button" onClick={unlink} disabled={loading}>
            No es este producto
          </button>
        </>
      ) : (
        <>
          <p className="muted small">
            {health.candidates.length ? '¿Cuál de estos es el tuyo? Al elegirlo, sus alérgenos se tendrán en cuenta en tus menús.' : 'No he encontrado este producto.'}
          </p>
          <ul className="candidate-list">
            {health.candidates.map((candidate) => (
              <li key={candidate.barcode}>
                <button type="button" className="candidate" onClick={() => link(candidate.barcode)} disabled={loading}>
                  <NutriScore grade={candidate.nutriscore} />
                  <span>
                    {candidate.name}
                    {candidate.brand && <span className="muted"> · {candidate.brand}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="inline-add">
            <input
              className="input"
              inputMode="numeric"
              placeholder="O escribe el código de barras"
              aria-label="Código de barras"
              value={barcode}
              maxLength={14}
              onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
            />
            <button type="button" className="button secondary" onClick={() => link(barcode)} disabled={loading || barcode.length < 6}>
              Buscar
            </button>
          </div>
        </>
      )}
      {error && <p className="notice error">{error}</p>}
    </section>
  );
}
