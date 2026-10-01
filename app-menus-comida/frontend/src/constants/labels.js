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

/** Where the assistant is opened from, per route (sent to the backend as context). */
export const SCREENS = {
  '/menu': { name: 'menu', label: 'Menú' },
  '/despensa': { name: 'pantry', label: 'Despensa' },
  '/despensa/compra': { name: 'purchase', label: 'Registrar compra' },
  '/lista': { name: 'shopping_list', label: 'Lista de la compra' },
  '/recetas': { name: 'recipes', label: 'Recetas' },
  '/ajustes': { name: 'settings', label: 'Ajustes' },
};
