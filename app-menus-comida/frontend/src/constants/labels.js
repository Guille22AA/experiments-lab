// Spanish labels for the values stored in English in the database.

export const MEAL_TYPE_LABELS = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  dinner: 'Cena',
  snack: 'Merienda',
};

export const EQUIPMENT_LABELS = {
  stovetop: 'Fuegos / vitro',
  oven: 'Horno',
  microwave: 'Microondas',
  airfryer: 'Freidora de aire',
  food_processor: 'Robot de cocina',
  blender: 'Batidora',
  pressure_cooker: 'Olla exprés',
};

export const MOTIVATION_LABELS = {
  low: 'Pocas',
  medium: 'Normales',
  high: 'Muchas',
};

export const SKILL_LABELS = {
  beginner: 'Principiante',
  intermediate: 'Me defiendo',
  advanced: 'Avanzado',
};

export const THEME_LABELS = {
  system: 'Sistema',
  light: 'Claro',
  dark: 'Oscuro',
};

/** Pantry levels, from most to least (the order used in selects). */
export const LEVEL_LABELS = {
  high: 'Mucho',
  medium: 'Medio',
  low: 'Poco',
  empty: 'Se acabó',
};

/** Tapping the level goes down one step (it is used up little by little); from "Se acabó" back to "Mucho". */
export const NEXT_LEVEL = { high: 'medium', medium: 'low', low: 'empty', empty: 'high' };

export const DIFFICULTY_LABELS = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' };

/** Quick feedback after cooking (no stars). */
export const VERDICT_LABELS = {
  loved: 'Me ha encantado, repítela',
  too_slow: 'Bien, pero tarda demasiado',
  disliked: 'No me ha quedado rica, no la propongas más',
  adjust: 'Ajustar…',
};

export const VERDICT_SHORT = { loved: 'Le encantó', too_slow: 'Tarda demasiado', disliked: 'No gustó', adjust: 'Ajustes' };

export const ADJUSTMENT_LABELS = {
  faster: 'Más rápida',
  simpler: 'Más sencilla',
  less_spicy: 'Menos picante',
  more_spicy: 'Más picante',
  lighter: 'Más ligera',
  bigger: 'Más cantidad',
};

export const SOURCE_LABELS = { ai: 'Propuesta por la IA', user: 'Escrita por ti', chat: 'Contada por ti', link: 'Importada de un enlace' };

/** Where the assistant is opened from, per route (sent to the backend as context). */
export const SCREENS = {
  '/menu': { name: 'menu', label: 'Menú' },
  '/despensa': { name: 'pantry', label: 'Despensa' },
  '/despensa/compra': { name: 'purchase', label: 'Registrar compra' },
  '/lista': { name: 'shopping_list', label: 'Lista de la compra' },
  '/recetas': { name: 'recipes', label: 'Recetas' },
  '/ajustes': { name: 'settings', label: 'Ajustes' },
  '/recetas/nueva': { name: 'recipe_form', label: 'Nueva receta' },
};

/** Screen info for any path, including the ones with an id ("/recetas/12"). */
export function screenFor(pathname) {
  if (SCREENS[pathname]) return SCREENS[pathname];
  if (/^\/recetas\/\d+\/editar$/.test(pathname)) return { name: 'recipe_form', label: 'Editar receta' };
  if (/^\/recetas\/\d+$/.test(pathname)) return { name: 'recipe', label: 'Receta' };
  return null;
}
