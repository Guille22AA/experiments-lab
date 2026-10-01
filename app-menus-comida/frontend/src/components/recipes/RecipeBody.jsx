// A recipe's content: facts, restriction warnings, ingredients and steps.
// Used in the menu dish sheet and in the recipe screen.
import { AlertTriangle, Clock } from 'lucide-react';
import { DIFFICULTY_LABELS } from '../../constants/labels.js';

export default function RecipeBody({ recipe }) {
  const badIngredients = new Set(recipe.check.violations.map((v) => v.ingredient));
  return (
    <div className="recipe-detail">
      {recipe.description && <p>{recipe.description}</p>}
      {(recipe.timeMinutes || recipe.difficulty || recipe.servings) && (
        <p className="recipe-facts muted small">
          {recipe.timeMinutes && (
            <span>
              <Clock size={14} aria-hidden="true" /> {recipe.timeMinutes} min
            </span>
          )}
          {recipe.difficulty && <span>{DIFFICULTY_LABELS[recipe.difficulty]}</span>}
          {recipe.servings && <span>{recipe.servings === 1 ? '1 ración' : `${recipe.servings} raciones`}</span>}
        </p>
      )}
      {recipe.check.violations.length > 0 && (
        <p className="notice error">
          <AlertTriangle size={16} aria-hidden="true" /> No cumple tus restricciones:{' '}
          {recipe.check.violations.map((v) => `${v.ingredient} (${v.restriction})`).join(', ')}
        </p>
      )}
      <h3>Ingredientes</h3>
      <ul className="ingredient-list">
        {recipe.ingredients.map((ingredient, index) => (
          <li key={ingredient.id ?? index} className={badIngredients.has(ingredient.name) ? 'is-bad' : ''}>
            {ingredient.name}
            {ingredient.quantityText && <span className="muted"> · {ingredient.quantityText}</span>}
            {ingredient.optional && <span className="muted"> (opcional)</span>}
          </li>
        ))}
      </ul>
      {recipe.check.unknown.length > 0 && (
        <p className="muted small">Sin datos de alérgenos: {recipe.check.unknown.join(', ')}. Revísalos si te importa.</p>
      )}
      {recipe.steps.length > 0 && (
        <>
          <h3>Pasos</h3>
          <ol className="step-list">
            {recipe.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
