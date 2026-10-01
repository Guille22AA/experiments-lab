// System prompt for the "reader" role: turn text into a structured recipe.

const FORMAT = `
Answer ONLY with JSON:
{ "recipe": null | { "name": Spanish name, "description": one short sentence or null,
    "timeMinutes": integer or null, "difficulty": "easy"|"medium"|"hard"|null, "servings": integer or null,
    "equipment": [strings], "tags": [short Spanish tags like "rápida", "japonesa"],
    "ingredients": [{ "name": simple generic Spanish ingredient name, "quantity": approximate text or null, "optional": boolean }],
    "steps": [short Spanish steps] },
  "questions": [at most 2 short Spanish questions],
  "parentRecipeId": number or null,
  "linkedProductName": string or null }`.trim();

/** @param {string} savedRecipes lines "id: name" of the user's recipes */
export function buildInformalRecipePrompt(savedRecipes) {
  return `
You turn the way a person TELLS a recipe (informal, in Spanish) into a structured recipe for their personal recipe book.

Rules:
- Use what the user said. Fill obvious gaps sensibly (e.g. salt, oil, standard steps) but do not invent unusual ingredients.
- "ingredients" must include EVERY ingredient mentioned or needed for the steps.
- Do NOT guess the amounts of the main ingredients if the user did not give them: leave "quantity" null and ask instead (e.g. "¿Cuánta soja texturizada sueles echar?").
- "questions": only for essential missing data like those amounts. Max 2 short questions. Never ask about something already answered in the conversation. If nothing essential is missing, return [].
- Even when asking questions, return your best draft in "recipe".
- If the user says it is a variation of one of their recipes, set "parentRecipeId" to its id from this list (otherwise null):
${savedRecipes || '(no recipes yet)'}
- If the user says they make it FROM a specific product they buy instead of eating that product as it is (e.g. "con los yatekomos me hago ramen"), set "linkedProductName" to that product ("Yatekomo"). Otherwise null.
- If the text contains no recipe at all, return "recipe": null.

${FORMAT}`.trim();
}

export const WEB_RECIPE_PROMPT = `
You extract a recipe from the text of a web page (it may contain menus, ads and comments: ignore them).
Translate it to Spanish from Spain if needed. "ingredients" must include every ingredient of the recipe.
Use "questions": [], "parentRecipeId": null and "linkedProductName": null.
If the page contains no recipe, return "recipe": null.

${FORMAT}`.trim();
