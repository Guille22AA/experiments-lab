// The recipe book: search, filter and open recipes; add new ones.
import { BookOpen, Clock, GitBranch, Plus, Search, Sparkles, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import ImportSheet from '../components/recipes/ImportSheet.jsx';
import { VERDICT_SHORT } from '../constants/labels.js';

const QUICK_MINUTES = 20;

const FILTERS = {
  all: { label: 'Todas', test: () => true },
  favorites: { label: 'Favoritas', test: (r) => r.isFavorite },
  quick: { label: 'Rápidas', test: (r) => (r.timeMinutes && r.timeMinutes <= QUICK_MINUTES) || r.tags.includes('rápida') },
};

/** Lowercase without accents, for searching. */
const simplify = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function RecipesPage() {
  const [recipes, setRecipes] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    api.get('/recipes').then(setRecipes).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="notice error">{error}</p>;
  if (!recipes) return <p className="muted">Cargando…</p>;

  const visible = recipes.filter((r) => FILTERS[filter].test(r) && simplify(r.name).includes(simplify(query.trim())));

  const addButtons = (
    <div className="button-row">
      <Link to="/recetas/nueva" className="button secondary">
        <Plus size={18} aria-hidden="true" /> Escribirla
      </Link>
      <button type="button" className="button" onClick={() => setImporting(true)}>
        <Sparkles size={18} aria-hidden="true" /> Contarla o enlace
      </button>
    </div>
  );

  return (
    <>
      {recipes.length === 0 ? (
        <div className="coming-soon">
          <BookOpen size={48} aria-hidden="true" />
          <h2>Tu memoria de cocina está vacía</h2>
          <p>Se irá llenando con los platos que cocines del menú. También puedes añadir tus recetas.</p>
          {addButtons}
        </div>
      ) : (
        <>
          {addButtons}
          <div className="search-box recipes-search">
            <Search size={20} aria-hidden="true" />
            <input type="search" value={query} placeholder="Buscar receta…" aria-label="Buscar receta" onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="chip-group filter-chips" role="group" aria-label="Filtrar">
            {Object.entries(FILTERS).map(([key, { label }]) => (
              <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
                {label}
              </button>
            ))}
          </div>

          {visible.length === 0 && <p className="muted center">No hay recetas que coincidan.</p>}
          <ul className="recipe-list">
            {visible.map((recipe) => (
              <li key={recipe.id}>
                <Link to={`/recetas/${recipe.id}`} className="recipe-card">
                  <span className="recipe-card-title">
                    {recipe.name}
                    {recipe.isFavorite && <Star size={16} className="star" aria-label="Favorita" />}
                  </span>
                  <span className="slot-meta">
                    {recipe.timeMinutes && (
                      <span>
                        <Clock size={14} aria-hidden="true" /> {recipe.timeMinutes} min
                      </span>
                    )}
                    {recipe.parentName && (
                      <span>
                        <GitBranch size={14} aria-hidden="true" /> de {recipe.parentName}
                      </span>
                    )}
                    {recipe.timesCooked > 0 && <span>{recipe.timesCooked === 1 ? 'Hecha 1 vez' : `Hecha ${recipe.timesCooked} veces`}</span>}
                    {recipe.lastVerdict && <span className={`verdict-tag verdict-${recipe.lastVerdict}`}>{VERDICT_SHORT[recipe.lastVerdict]}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </>
  );
}
