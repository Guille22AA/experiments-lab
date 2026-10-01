// Edit a list item: approximate quantity, or remove it.
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import Sheet from '../ui/Sheet.jsx';

export default function ListItemSheet({ item, onSave, onDelete, onClose }) {
  const [quantity, setQuantity] = useState(item.quantityText ?? '');
  const [error, setError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      await onSave({ quantityText: quantity.trim() });
      onClose();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Sheet title={item.text} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <label className="field">
          <span className="field-label">Cantidad aproximada</span>
          <input className="input" value={quantity} maxLength={60} placeholder="Ej.: 2 paquetes, 1 kg" onChange={(e) => setQuantity(e.target.value)} />
        </label>
        {error && <p className="notice error">{error}</p>}
        <button type="submit" className="button full">
          Guardar
        </button>
        <button type="button" className="button danger full sheet-secondary" onClick={onDelete}>
          <Trash2 size={18} aria-hidden="true" /> Quitar de la lista
        </button>
      </form>
    </Sheet>
  );
}
