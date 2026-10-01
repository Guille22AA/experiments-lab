// Shopping list by supermarket section, in walking order.
// In the shop: tap to tick; ticked items go to the bottom of their section.
import { Check, MoreHorizontal, Share2, ShoppingCart, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ExportSheet from '../components/list/ExportSheet.jsx';
import ListItemSheet from '../components/list/ListItemSheet.jsx';
import ProductSearch from '../components/pantry/ProductSearch.jsx';
import SwipeRow from '../components/ui/SwipeRow.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDataChanged } from '../hooks/useDataChanged.js';
import { groupPending } from '../lib/exportList.js';

/** Sections with their items: pending first (in the order they were added), ticked at the end. */
function groupForScreen(items, sections) {
  const byTick = (a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1) || (a.checkedAt ?? '').localeCompare(b.checkedAt ?? '');
  const groups = sections.map((s) => ({ id: s.id, name: s.name, items: items.filter((i) => i.sectionId === s.id) }));
  groups.push({ id: 'none', name: 'Otros', items: items.filter((i) => !i.sectionId) });
  return groups.filter((g) => g.items.length > 0).map((g) => ({ ...g, items: [...g.items].sort(byTick) }));
}

export default function ShoppingListPage() {
  const showToast = useToast();
  const [items, setItems] = useState(null);
  const [sections, setSections] = useState([]);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.get('/shopping-list');
      setItems(list.items);
      setSections(list.sections);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(load); // the assistant may change things from the chat

  const replaceItem = (updated) => setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)));

  async function add(choice) {
    try {
      const item = await api.post('/shopping-list', { ...choice, source: 'manual' });
      await load();
      if (item.alreadyThere) showToast(`${item.text} ya estaba en la lista`);
    } catch (err) {
      showToast(err.message);
    }
  }

  async function toggle(item) {
    const checked = !item.checked;
    replaceItem({ ...item, checked, checkedAt: checked ? new Date().toISOString() : null }); // instant
    try {
      replaceItem(await api.patch(`/shopping-list/${item.id}`, { checked }));
    } catch (err) {
      replaceItem(item);
      showToast(err.message);
    }
  }

  async function remove(item) {
    setItems((current) => current.filter((i) => i.id !== item.id));
    setEditing(null);
    try {
      const deleted = await api.delete(`/shopping-list/${item.id}`);
      showToast(`Quitado: ${item.text}`, {
        actionLabel: 'Deshacer',
        onAction: () => api.post('/shopping-list/restore', deleted).then(load).catch((err) => showToast(err.message)),
      });
    } catch (err) {
      showToast(err.message);
      load();
    }
  }

  async function clearChecked() {
    const { removed } = await api.delete('/shopping-list/checked');
    await load();
    showToast(`${removed} quitados de la lista`);
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!items) return <p className="muted">Cargando…</p>;

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <>
      <ProductSearch onPick={add} placeholder="Añadir a la lista…" />

      {items.length === 0 ? (
        <div className="coming-soon">
          <ShoppingCart size={48} aria-hidden="true" />
          <h2>La lista está vacía</h2>
          <p>Añade lo que necesites, pásalo desde el menú o desde lo que se acabó en la despensa.</p>
        </div>
      ) : (
        <>
          <div className="list-toolbar">
            <span className="muted small" aria-live="polite">
              {checkedCount} de {items.length} en el carro
            </span>
            <button type="button" className="button secondary" onClick={() => setExporting(true)}>
              <Share2 size={18} aria-hidden="true" /> Llevar la lista
            </button>
          </div>

          {groupForScreen(items, sections).map((group) => (
            <section key={group.id} className="pantry-section">
              <h2 className="section-title">{group.name}</h2>
              <ul className="item-list">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <SwipeRow onDelete={() => remove(item)}>
                      <div className={`list-item ${item.checked ? 'is-checked' : ''}`}>
                        <button type="button" className="list-item-toggle" role="checkbox" aria-checked={item.checked} onClick={() => toggle(item)}>
                          <span className="tick" aria-hidden="true">
                            {item.checked && <Check size={18} />}
                          </span>
                          <span className="list-item-text">
                            {item.text}
                            {item.quantityText && <span className="muted small"> · {item.quantityText}</span>}
                          </span>
                        </button>
                        <button type="button" className="icon-button" onClick={() => setEditing(item)} aria-label={`Opciones de ${item.text}`}>
                          <MoreHorizontal size={20} aria-hidden="true" />
                        </button>
                      </div>
                    </SwipeRow>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {checkedCount > 0 && (
            <button type="button" className="button secondary full" onClick={clearChecked}>
              <Trash2 size={18} aria-hidden="true" /> Quitar lo tachado ({checkedCount})
            </button>
          )}
          <p className="muted hint">Toca para tachar · Desliza a la izquierda para quitar</p>
        </>
      )}

      {/* Printed version: only what is still to buy, plain and compact. */}
      <div className="print-only">
        <h1>Lista de la compra</h1>
        {groupPending(items, sections).map((group) => (
          <section key={group.name}>
            <h2>{group.name}</h2>
            <ul>
              {group.items.map((item) => (
                <li key={item.id}>
                  ☐ {item.text}
                  {item.quantityText ? ` (${item.quantityText})` : ''}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {editing && (
        <ListItemSheet
          item={editing}
          onSave={async (changes) => replaceItem(await api.patch(`/shopping-list/${editing.id}`, changes))}
          onDelete={() => remove(editing)}
          onClose={() => setEditing(null)}
        />
      )}
      {exporting && <ExportSheet items={items} sections={sections} onClose={() => setExporting(false)} />}
    </>
  );
}
