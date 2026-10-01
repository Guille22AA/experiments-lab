// Recipe import: from an informal text ("mi madre compró yatekomos y con ellos
// me hago ramen...") or from a link. Nothing is saved here: the result is a
// draft the user reviews and saves from the recipe form.
import { generateJson } from '../ai/aiService.js';
import { buildInformalRecipePrompt, WEB_RECIPE_PROMPT } from '../ai/prompts/recipeImportPrompt.js';
import { recipeImportSchema } from '../ai/schemas/recipeImportSchema.js';
import { getProfile } from '../db/repositories/profileRepo.js';
import { listRecipeSummaries, recipeExists } from '../db/repositories/recipeRepo.js';
import { fetchPage } from '../lib/fetchPage.js';
import { HttpError } from '../lib/errors.js';
import { capitalize } from '../lib/text.js';
import { findJsonLdRecipe, htmlToText, jsonLdToDraft } from '../lib/recipePage.js';
import { checkIngredients } from './restrictionCheck.js';

// Videos are not imported (decided with the user): they are told by text instead.
const VIDEO_HOSTS = /(^|\.)(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|vimeo\.com|twitch\.tv)$/i;

/** AI draft → form draft (same shape the recipe form uses). */
function toFormDraft(recipe) {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map(({ quantity, ...ingredient }) => ({
      ...ingredient,
      name: capitalize(ingredient.name),
      quantityText: quantity ?? null,
    })),
  };
}

/** Adds the restriction check, so the review screen can warn before saving. */
function withCheck(result) {
  return { ...result, check: checkIngredients(result.draft.ingredients, getProfile().restrictions) };
}

/**
 * @param {string} text what the user told
 * @param {{ question: string, answer: string }[]} answers answers to the AI's previous questions
 */
export async function importFromText(text, answers = []) {
  const savedRecipes = listRecipeSummaries()
    .map((r) => `${r.id}: ${r.name}`)
    .join('\n');
  const messages = [{ role: 'user', content: text }];
  if (answers.length > 0) {
    messages.push({ role: 'user', content: answers.map((a) => `${a.question} → ${a.answer}`).join('\n') });
  }

  const result = await generateJson({ system: buildInformalRecipePrompt(savedRecipes), messages, schema: recipeImportSchema });
  if (!result.recipe) throw new HttpError(422, 'No he encontrado una receta en lo que me cuentas. Prueba a decir qué ingredientes usas y cómo lo haces.');

  return withCheck({
    draft: {
      ...toFormDraft(result.recipe),
      source: 'chat',
      parentRecipeId: result.parentRecipeId && recipeExists(result.parentRecipeId) ? result.parentRecipeId : null,
      linkedProductName: result.linkedProductName,
    },
    // Questions already answered are not asked again.
    questions: answers.length > 0 ? [] : result.questions,
    method: 'ai',
  });
}

export async function importFromUrl(rawUrl) {
  let host = '';
  try {
    host = new URL(rawUrl).hostname;
  } catch {
    throw new HttpError(400, 'Eso no parece un enlace.');
  }
  if (VIDEO_HOSTS.test(host)) {
    throw new HttpError(422, 'Los vídeos no se pueden importar. Cuéntame la receta con tus palabras (o pega la descripción del vídeo) y la apunto.');
  }

  const { html, finalUrl } = await fetchPage(rawUrl);

  // 1) Structured data on the page: no AI needed.
  const jsonLd = findJsonLdRecipe(html);
  if (jsonLd) {
    const draft = jsonLdToDraft(jsonLd);
    if (draft.ingredients.length > 0) {
      return withCheck({ draft: { ...draft, source: 'link', sourceUrl: finalUrl }, questions: [], method: 'jsonld' });
    }
  }

  // 2) No structured data: the AI reads the page text.
  const text = htmlToText(html);
  if (text.length < 200) throw new HttpError(422, 'No he podido leer el texto de esa página. Pega el texto de la receta.');
  const result = await generateJson({
    system: WEB_RECIPE_PROMPT,
    messages: [{ role: 'user', content: `Página: ${finalUrl}\n\n${text}` }],
    schema: recipeImportSchema,
  });
  if (!result.recipe) throw new HttpError(422, 'No he encontrado ninguna receta en esa página.');
  return withCheck({ draft: { ...toFormDraft(result.recipe), source: 'link', sourceUrl: finalUrl }, questions: [], method: 'ai' });
}
