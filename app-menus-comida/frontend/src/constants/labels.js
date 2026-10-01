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

/** Where the assistant is opened from, per route (sent to the backend as context). */
export const SCREENS = {
  '/menu': { name: 'menu', label: 'Menú' },
  '/despensa': { name: 'pantry', label: 'Despensa' },
  '/lista': { name: 'shopping_list', label: 'Lista de la compra' },
  '/recetas': { name: 'recipes', label: 'Recetas' },
  '/ajustes': { name: 'settings', label: 'Ajustes' },
};
