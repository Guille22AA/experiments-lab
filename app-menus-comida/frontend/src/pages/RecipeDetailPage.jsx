// One recipe: content, links (variations, linked product), history and feedback.
import { ChefHat, ExternalLink, GitBranch, MessageCircle, Package, Pencil, Star, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import AfterCooking from '../components/recipes/AfterCooking.jsx';
import RecipeBody from '../components/recipes/RecipeBody.jsx';
import { ADJUSTMENT_LABELS, LEVEL_LABELS, SOURCE_LABELS, VERDICT_SHORT } from '../constants/labels.js';
import { useAssistant } from '../context/AssistantContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDataChanged } from '../hooks/useDataChanged.js';

const formatDate = (iso) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

export default function RecipeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();
  const { openAssistant } = useAssistant();
  const [recipe, setRecipe] = useState(null);
  const [error, setError] = useState(null);
  const [cooked, setCooked] = useState(null);

  const load = useCallback(() => api.get(`/recipes/${id}`).then(setRecipe).catch((err) => setError(err.message)), [id]);

  useEffect(() => {
    load();
  }, [load]);
  useDataChanged(load); // the assistant may change things from the chat

  async function toggleFavorite() {
    const isFavorite = !recipe.isFavorite;
    setRecipe({ ...recipe, isFavorite });
    await api.patch(`/recipes/${id}/favorite`, { isFavorite }).catch(() => setRecipe(recipe));
  }

  async function markCooked() {
    try {
      const result = await api.post(`/recipes/${id}/cooked`);
      setCooked({ ...result, title: recipe.name });
      load();
    } catch (err) {
      showToast(err.message);
    }
  }

  async function remove() {
    if (!window.confirm(`¿Borrar «${recipe.name}»? Sus variaciones se quedarán como recetas sueltas.`)) return;
    await api.delete(`/recipes/${id}`);
    showToast('Receta borrada');
    navigate('/recetas', { replace: true });
  }

  function createVariation() {
    const { name, description, timeMinutes, difficulty, servings, tags, equipment, ingredients, steps } = recipe;
    navigate('/recetas/nueva', {
      state: {
        draft: { name: `${name} (variación)`, description, timeMinutes, difficulty, servings, tags, equipment, ingredients, steps, parentRecipeId: recipe.id },
      },
    });
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!recipe) return <p className="muted">Cargando…</p>;

  return (
    <>
      <div className="recipe-head">
        <h2>{recipe.name}</h2>
        <button
          type="button"
          className={`icon-button ${recipe.isFavorite ? 'is-favorite' : ''}`}
          onClick={toggleFavorite}
          aria-pressed={recipe.isFavorite}
          aria-label={recipe.isFavorite ? 'Quitar de favoritas' : 'Marcar como favorita'}
        >
          <Star size={24} aria-hidden="true" />
        </button>
      </div>

      <div className="recipe-links muted small">
        <span>{SOURCE_LABELS[recipe.source]}</span>
        {recipe.sourceUrl && (
          <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">
            Ver original <ExternalLink size={14} aria-hidden="true" />
          </a>
        )}
        {recipe.parent && (
          <Link to={`/recetas/${recipe.parent.id}`}>
            <GitBranch size={14} aria-hidden="true" /> Variación de {recipe.parent.name}
          </Link>
        )}
      </div>

      {recipe.linkedProduct && (
        <p className="notice ok linked-product">
          <Package size={16} aria-hidden="true" /> Tu forma de usar <strong>{recipe.linkedProduct.name}</strong>
          {recipe.linkedProduct.pantryLevel
            ? ` (en casa: ${LEVEL_LABELS[recipe.linkedProduct.pantryLevel].toLowerCase()})`
            : ' (ahora no tienes)'}
          . Cuando lo tengas, el menú propondrá esta receta.
        </p>
      )}

      <section className="card">
        <RecipeBody recipe={recipe} />
        <button
          type="button"
          className="link-button ask-assistant"
          onClick={() => openAssistant({ name: 'recipe', label: `Receta: ${recipe.name}`, recipeId: recipe.id })}
        >
          <MessageCircle size={16} aria-hidden="true" /> Preguntar al asistente sobre esta receta
        </button>
      </section>

      <button type="button" className="button full" onClick={markCooked}>
        <ChefHat size={18} aria-hidden="true" /> Lo he cocinado hoy
      </button>
      <div className="button-row">
        <Link to={`/recetas/${recipe.id}/editar`} className="button secondary">
          <Pencil size={18} aria-hidden="true" /> Editar
        </Link>
        <button type="button" className="button secondary" onClick={createVariation}>
          <GitBranch size={18} aria-hidden="true" /> Variación
        </button>
      </div>

      {recipe.variations.length > 0 && (
        <section className="card section-gap">
          <h2>Variaciones</h2>
          <ul className="choice-list compact">
            {recipe.variations.map((v) => (
              <li key={v.id}>
                <Link to={`/recetas/${v.id}`} className="choice-row">
                  {v.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card section-gap">
        <h2>Tu historial</h2>
        {recipe.cooked.length === 0 ? (
          <p className="muted">Aún no la has cocinado.</p>
        ) : (
          <p>
            {recipe.cooked.length === 1 ? 'Hecha 1 vez' : `Hecha ${recipe.cooked.length} veces`}, la última el {formatDate(recipe.cooked[0].cookedAt)}.
          </p>
        )}
        {recipe.feedback.length > 0 && (
          <ul className="feedback-list">
            {recipe.feedback.map((f) => (
              <li key={f.id}>
                <span className={`verdict-tag verdict-${f.verdict}`}>{VERDICT_SHORT[f.verdict]}</span>
                {f.adjustments.length > 0 && <span> {f.adjustments.map((a) => ADJUSTMENT_LABELS[a]).join(', ')}</span>}
                {f.note && <span className="muted"> — {f.note}</span>}
                <span className="muted small">
                  {' '}
                  · {formatDate(f.createdAt)}
                  {f.isFirstTime ? ' (primera vez)' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <button type="button" className="button danger full section-gap" onClick={remove}>
        <Trash2 size={18} aria-hidden="true" /> Borrar receta
      </button>

      {cooked && (
        <AfterCooking
          cooked={cooked}
          onFinish={() => {
            setCooked(null);
            load();
          }}
        />
      )}
    </>
  );
}
