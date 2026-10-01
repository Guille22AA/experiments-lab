// Dietary restrictions catalog.
//
// Restrictions are HARD filters checked in code (not only instructions to the AI).
// Each restriction lists the ingredient/recipe tags it forbids. Products and
// recipes get tagged (Open Food Facts allergens + our own dictionary), and in
// phase 3 `checkRecipe()` will compare those tags against this catalog.

/** Tags that an ingredient or recipe can carry. */
export const TAGS = [
  'contains_gluten',
  'contains_lactose',
  'contains_dairy',
  'contains_egg',
  'contains_nuts',
  'contains_peanuts',
  'contains_soy',
  'contains_fish',
  'contains_shellfish',
  'contains_sesame',
  'contains_meat',
  'contains_pork',
  'animal_origin',
];

/** Known restrictions: code → label (Spanish UI), kind and forbidden tags. */
export const RESTRICTIONS = {
  gluten: { label: 'Sin gluten (celiaquía)', kind: 'intolerance', forbids: ['contains_gluten'] },
  lactose: { label: 'Sin lactosa', kind: 'intolerance', forbids: ['contains_lactose'] },
  dairy: { label: 'Alergia a la leche', kind: 'allergy', forbids: ['contains_dairy', 'contains_lactose'] },
  egg: { label: 'Alergia al huevo', kind: 'allergy', forbids: ['contains_egg'] },
  nuts: { label: 'Alergia a frutos secos', kind: 'allergy', forbids: ['contains_nuts'] },
  peanuts: { label: 'Alergia al cacahuete', kind: 'allergy', forbids: ['contains_peanuts'] },
  soy: { label: 'Alergia a la soja', kind: 'allergy', forbids: ['contains_soy'] },
  fish: { label: 'Alergia al pescado', kind: 'allergy', forbids: ['contains_fish'] },
  shellfish: { label: 'Alergia al marisco', kind: 'allergy', forbids: ['contains_shellfish'] },
  sesame: { label: 'Alergia al sésamo', kind: 'allergy', forbids: ['contains_sesame'] },
  vegetarian: { label: 'Vegetariano', kind: 'diet', forbids: ['contains_meat', 'contains_pork', 'contains_fish', 'contains_shellfish'] },
  vegan: { label: 'Vegano', kind: 'diet', forbids: ['animal_origin'] },
  no_pork: { label: 'Sin cerdo', kind: 'diet', forbids: ['contains_pork'] },
};

/**
 * `other` = something not in the catalog (e.g. "alergia al kiwi").
 * It cannot be checked with tags, so the app will always warn about it.
 */
export const RESTRICTION_CODES = [...Object.keys(RESTRICTIONS), 'other'];

/** Catalog as a list, for the settings screen. */
export function listRestrictionCatalog() {
  return Object.entries(RESTRICTIONS).map(([code, info]) => ({ code, label: info.label, kind: info.kind }));
}
