// Search box for products: suggests known products and lets you add a new one.
import { Plus, Search } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { api } from '../../api/client.js';

const DEBOUNCE_MS = 200;

const toChoice = (product) => ({ productId: product.id, name: product.name, sectionId: product.sectionId });

/**
 * @param {{ onPick: (choice: { productId?: number, name: string, sectionId?: number|null }) => void, placeholder?: string }} props
 * Known products come with productId and sectionId; new names only with name.
 */
export default function ProductSearch({ onPick, placeholder = 'Buscar o añadir producto…' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const listId = useId();
  const trimmed = query.trim();

  // Ask the backend for matches a moment after the user stops typing.
  useEffect(() => {
    if (!trimmed) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      api.get(`/products?q=${encodeURIComponent(trimmed)}`).then(setResults).catch(() => setResults([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed]);

  function pick(choice) {
    onPick(choice);
    setQuery('');
    setResults([]);
  }

  const exactMatch = results.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="product-search">
      <div className="search-box">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-controls={listId}
          maxLength={120}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && trimmed) {
              event.preventDefault();
              pick(exactMatch ? toChoice(exactMatch) : { name: trimmed });
            }
          }}
        />
      </div>
      {trimmed && (
        <ul className="suggestions" id={listId}>
          {results.map((product) => (
            <li key={product.id}>
              <button type="button" onClick={() => pick(toChoice(product))}>
                {product.name}
              </button>
            </li>
          ))}
          {!exactMatch && (
            <li>
              <button type="button" className="add-new" onClick={() => pick({ name: trimmed })}>
                <Plus size={18} aria-hidden="true" /> Añadir «{trimmed}»
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
