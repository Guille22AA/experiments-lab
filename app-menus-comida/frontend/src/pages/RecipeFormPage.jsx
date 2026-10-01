// New recipe / edit recipe / review an imported draft.
// An imported draft arrives in the navigation state: { draft, check, method }.
import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import RecipeForm from '../components/recipes/RecipeForm.jsx';

export default function RecipeFormPage() {
  const { id } = useParams();
  const recipeId = id ? Number(id) : null;
  const navigate = useNavigate();
  const { state } = useLocation();
  const [recipe, setRecipe] = useState(recipeId ? null : (state?.draft ?? {}));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (recipeId) api.get(`/recipes/${recipeId}`).then(setRecipe).catch((err) => setError(err.message));
  }, [recipeId]);

  async function save(payload) {
    const saved = recipeId ? await api.put(`/recipes/${recipeId}`, payload) : await api.post('/recipes', payload);
    navigate(`/recetas/${saved.id}`, { replace: true });
  }

  if (error) return <p className="notice error">{error}</p>;
  if (!recipe) return <p className="muted">Cargando…</p>;

  const check = state?.check;
  return (
    <>
      {state?.draft && (
        <section className="card draft-banner">
          <h2>Revisa la receta</h2>
          <p className="muted">
            {state.method === 'jsonld'
              ? 'La he leído de la página tal cual. Corrige lo que quieras y guárdala.'
              : 'Así la he entendido. Corrige lo que quieras y guárdala.'}
          </p>
          {check?.violations.length > 0 && (
            <p className="notice error">
              <AlertTriangle size={16} aria-hidden="true" /> No cumple tus restricciones:{' '}
              {check.violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ')}. Puedes guardarla igualmente; no
              entrará en tus menús así.
            </p>
          )}
          {check?.unknown.length > 0 && <p className="muted small">Sin datos de alérgenos: {check.unknown.join(', ')}.</p>}
        </section>
      )}
      <RecipeForm initial={recipe} recipeId={recipeId} submitLabel={recipeId ? 'Guardar cambios' : 'Guardar receta'} onSubmit={save} />
    </>
  );
}
