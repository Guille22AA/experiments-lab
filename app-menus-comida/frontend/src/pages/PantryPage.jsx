// Pantry: what is at home, grouped by supermarket section.
// Tap the level to lower it, swipe left to remove, tap the name for more options.
import { Package, ShoppingCart } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import CycleCard from '../components/pantry/CycleCard.jsx';
import LevelButton from '../components/pantry/LevelButton.jsx';
import PantryItemSheet from '../components/pantry/PantryItemSheet.jsx';
import ProductSearch from '../components/pantry/ProductSearch.jsx';
import SwipeRow from '../components/ui/SwipeRow.jsx';
import { useToast } from '../context/ToastContext.jsx';

/** Groups items by section, keeping the walking order. Items without section go to "Otros". */
function groupBySection(items, sections) {
  const groups = sections.map((section) => ({ ...section, items: items.filter((i) => i.sectionId === section.id) }));
  groups.push({ id: 'none', name: 'Otros', items: items.filter((i) => !i.sectionId) });
  return groups.filter((group) => group.items.length > 0);
}

export default function PantryPage() {
  const showToast = useToast();
  const [items, setItems] = useState(null);
  const [sections, setSections] = useState([]);
  const [cycleStatus, setCycleStatus] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null); // item open in the sheet

  const load = useCallback(async () => {
    try {
      const [pantry, cycle] = await Promise.all([api.get('/pantry'), api.get('/purchases/cycle')]);
      setItems(pantry.items);
      setSections(pantry.sections);
      setCycleStatus(cycle);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const replaceItem = (updated) => setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));

  async function addProduct(choice) {
    try {
      const item = await api.post('/pantry', { ...choice, level: 'medium' });
      await load();
      showToast(item.alreadyThere ? `${item.name} ya estaba en la despensa` : `Añadido: ${item.name}`);
    } catch (err) {
      showToast(err.message);
    }
  }

  async function addToList(item) {
    try {
      const added = await api.post(`/shopping-list/from-pantry/${item.id}`);
      showToast(added.alreadyThere ? `${item.name} ya estaba en la lista` : `${item.name} añadido a la lista`);
    } catch (err) {
      showToast(err.message);
    }
  }

  async function changeLevel(item, level) {
    replaceItem({ ...item, level }); // instant feedback, then save
    try {
      replaceItem(await api.patch(`/pantry/${item.id}`, { level }));
      // Just ran out: offer the shortcut to the shopping list.
      if (level === 'empty') {
        showToast(`Se acabó: ${item.name}`, { actionLabel: 'Añadir a la lista', onAction: () => addToList(item) });
      }
    } catch (err) {
      replaceItem(item); // put it back as it was
      showToast(err.message);
    }
  }

  async function removeItem(item) {
    setItems((current) => current.filter((i) => i.id !== item.id));
    setEditing(null);
    try {
      const deleted = await api.delete(`/pantry/${item.id}`);
      showToast(`Quitado: ${item.name}`, {
        actionLabel: 'Deshacer',
        onAction: async () => {
          await api.post('/pantry/restore', { productId: deleted.productId, level: deleted.level, addedAt: deleted.addedAt });
          load();
        },
      });
    } catch (err) {
      showToast(err.message);
      load();
    }
  }

  async function saveItem(item, changes) {
    if (changes.name !== item.name || (changes.sectionId && changes.sectionId !== item.sectionId)) {
      await api.patch(`/products/${item.productId}`, {
        ...(changes.name !== item.name && { name: changes.name }),
        ...(changes.sectionId && changes.sectionId !== item.sectionId && { sectionId: changes.sectionId }),
      });
    }
    if (changes.level !== item.level) await api.patch(`/pantry/${item.id}`, { level: changes.level });
    await load();
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!items) return <p className="muted">Cargando…</p>;

  const groups = groupBySection(items, sections);

  return (
    <>
      <CycleCard status={cycleStatus} />
      <ProductSearch onPick={addProduct} />

      {items.length === 0 ? (
        <div className="coming-soon">
          <Package size={48} aria-hidden="true" />
          <h2>La despensa está vacía</h2>
          <p>Añade lo que tienes en casa con el buscador, o registra una compra.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.id} className="pantry-section">
            <h2 className="section-title">{group.name}</h2>
            <ul className="item-list">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SwipeRow onDelete={() => removeItem(item)}>
                    <div className={`pantry-item ${item.level === 'empty' ? 'is-empty' : ''}`}>
                      <button type="button" className="pantry-item-name" onClick={() => setEditing(item)}>
                        {item.name}
                      </button>
                      {item.level === 'empty' && (
                        <button type="button" className="icon-button" onClick={() => addToList(item)} aria-label={`Añadir ${item.name} a la lista`}>
                          <ShoppingCart size={20} aria-hidden="true" />
                        </button>
                      )}
                      <LevelButton level={item.level} productName={item.name} onChange={(level) => changeLevel(item, level)} />
                    </div>
                  </SwipeRow>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {items.length > 0 && <p className="muted hint">Toca el nivel para bajarlo · Desliza a la izquierda para quitar</p>}

      {editing && (
        <PantryItemSheet
          item={editing}
          sections={sections}
          onSave={(changes) => saveItem(editing, changes)}
          onDelete={() => removeItem(editing)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
