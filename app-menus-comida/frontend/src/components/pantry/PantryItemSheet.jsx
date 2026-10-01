// Detail of a pantry product: rename, change section, level or approximate
// price, remove, and its health info.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { LEVEL_LABELS } from '../../constants/labels.js';
import ProductHealth from '../products/ProductHealth.jsx';
import Sheet from '../ui/Sheet.jsx';

/** "1,5" or "1.5" → 1.5; empty → null. */
const parsePrice = (text) => (text.trim() ? Number(text.replace(',', '.')) : null);

export default function PantryItemSheet({ item, sections, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item.name);
  const [sectionId, setSectionId] = useState(item.sectionId ?? '');
  const [level, setLevel] = useState(item.level);
  const [price, setPrice] = useState(item.approxPrice != null ? String(item.approxPrice).replace('.', ',') : '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const approxPrice = parsePrice(price);
    if (approxPrice !== null && !(approxPrice >= 0 && approxPrice <= 1000)) {
      setError('El precio no parece correcto.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), sectionId: sectionId ? Number(sectionId) : null, level, approxPrice });
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Sheet title={item.name} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Nombre</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        </label>
        <div className="field-row">
          <label className="field">
            <span className="field-label">Sección del súper</span>
            <select className="input" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
              {!item.sectionId && <option value="">Sin sección</option>}
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Precio aprox. (€)</span>
            <input className="input" inputMode="decimal" placeholder="Ej.: 1,20" value={price} maxLength={8} onChange={(e) => setPrice(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <span className="field-label">Cuánto queda</span>
          <div className="segmented" role="group" aria-label="Cuánto queda">
            {Object.entries(LEVEL_LABELS).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={level === value} onClick={() => setLevel(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="notice error">{error}</p>}
        <button type="submit" className="button full" disabled={saving || !name.trim()}>
          Guardar
        </button>
        <button type="button" className="button danger full sheet-secondary" onClick={onDelete}>
          <Trash2 size={18} aria-hidden="true" /> Quitar de la despensa
        </button>
      </form>
      <ProductHealth productId={item.productId} />
    </Sheet>
  );
}
