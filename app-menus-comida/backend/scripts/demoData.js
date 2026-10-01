// Demo data, to try the app (or take screenshots) without spending AI calls.
// Usage (from the project root):  npm run demo
// It writes to backend/data/demo.db and never touches your real database.
import fs from 'node:fs';
import path from 'node:path';

const demoDb = path.resolve(import.meta.dirname, '../data/demo.db');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(demoDb + suffix, { force: true });
process.env.DB_PATH = demoDb; // must be set before the database module loads

const { saveProfile } = await import('../src/db/repositories/profileRepo.js');
const { setPantryLevel } = await import('../src/db/repositories/pantryRepo.js');
const { setApproxPrice } = await import('../src/db/repositories/productRepo.js');
const { createRecipe, addFeedback } = await import('../src/db/repositories/recipeRepo.js');
const { createMenu, addSlot, updateSlot, logCooked } = await import('../src/db/repositories/menuRepo.js');
const { createCycle, createPurchase } = await import('../src/db/repositories/purchaseRepo.js');
const { addMessage } = await import('../src/db/repositories/chatRepo.js');
const { createAction } = await import('../src/db/repositories/actionRepo.js');
const { resolveProduct } = await import('../src/domain/products.js');
const { addToList } = await import('../src/domain/shoppingList.js');
const { describeAction } = await import('../src/domain/assistantActions.js');
const { addDays, todayLocal } = await import('../src/lib/dates.js');

const today = todayLocal();
const start = addDays(today, -1); // the cycle started yesterday

saveProfile(
  {
    peopleCount: 1,
    mealsToPlan: ['lunch', 'dinner'],
    cookingMotivation: 'low',
    weekdayMinutes: 25,
    weekendMinutes: 75,
    skillLevel: 'intermediate',
    equipment: ['stovetop', 'oven', 'airfryer', 'microwave'],
    likes: ['ramen', 'legumbres', 'comida japonesa', 'tortilla de patatas'],
    dislikes: ['coliflor'],
    batchCooking: true,
    usesLeftovers: true,
    shoppingFrequencyDays: 7,
    extraNotes: ['Los lunes como fuera'],
    restrictions: [{ code: 'other', kind: 'other', label: 'Alergia al kiwi', note: null }],
  },
  { completeOnboarding: true },
);

// Pantry: [name, level, approx price]
const pantry = [
  ['Arroz', 'high', 1.15], ['Garbanzos cocidos', 'medium', 0.85], ['Lentejas', 'low', 1.3], ['Pasta', 'high', 0.9],
  ['Huevos', 'medium', 2.2], ['Leche semidesnatada', 'high', 0.92], ['Yogures naturales', 'low', 1.4],
  ['Pechuga de pollo', 'high', 5.6], ['Tomate', 'medium', 1.9], ['Cebolla', 'high', 1.2], ['Calabacín', 'low', 1.6],
  ['Patatas', 'high', 2.5], ['Yatekomo pollo', 'high', 0.95], ['Soja texturizada', 'medium', 1.6],
  ['Salsa teriyaki', 'medium', 1.95], ['Pan de molde', 'empty', 1.25], ['Aceite de oliva', 'medium', 8.5],
];
for (const [name, level, price] of pantry) {
  const product = resolveProduct({ name });
  setPantryLevel(product.id, level);
  setApproxPrice(product.id, price);
}

const cycleId = createCycle({ startedAt: `${start}T18:30:00.000Z`, plannedDays: 7 });
createPurchase({ cycleId, kind: 'main', purchasedAt: `${start}T18:30:00.000Z`, source: 'ticket_image', totalPrice: 54.3 });

const recipe = (r) => createRecipe({ source: 'ai', status: 'saved', ...r });
const ramen = recipe({
  name: 'Ramen casero', source: 'chat', timeMinutes: 20, difficulty: 'easy', servings: 1, tags: ['rápida', 'japonesa'],
  description: 'Mi forma de usar los Yatekomo: con soja texturizada y teriyaki.',
  linkedProductId: resolveProduct({ name: 'Yatekomo pollo' }).id,
  ingredients: [
    { name: 'Yatekomo pollo', quantityText: '1 paquete' }, { name: 'Soja texturizada', quantityText: '40 g' },
    { name: 'Salsa teriyaki', quantityText: '2 cucharadas' }, { name: 'Huevos', quantityText: '1', optional: true },
  ],
  steps: ['Hidrata la soja texturizada 10 minutos en agua caliente.', 'Saltéala con la salsa teriyaki.', 'Prepara los fideos y sirve la soja por encima, con el huevo cocido si quieres.'],
});
const ramenPollo = recipe({
  name: 'Ramen con pollo', source: 'user', timeMinutes: 25, tags: ['japonesa'], parentRecipeId: ramen,
  ingredients: [{ name: 'Yatekomo pollo' }, { name: 'Pechuga de pollo', quantityText: '150 g' }, { name: 'Salsa teriyaki' }],
  steps: ['Dora el pollo en tiras.', 'Añade la teriyaki.', 'Sírvelo sobre los fideos.'],
});
const garbanzos = recipe({
  name: 'Garbanzos salteados con huevo', timeMinutes: 15, difficulty: 'easy', servings: 1, tags: ['rápida'],
  description: 'Un plato de diario en un cuarto de hora.',
  ingredients: [{ name: 'Garbanzos cocidos', quantityText: '1 bote' }, { name: 'Huevos', quantityText: '2' }, { name: 'Tomate', quantityText: '1' }, { name: 'Cebolla', quantityText: '1/2' }],
  steps: ['Pocha la cebolla.', 'Añade el tomate y los garbanzos escurridos.', 'Casca los huevos y remueve hasta que cuajen.'],
});
const arroz = recipe({
  name: 'Arroz con pollo y verduras', timeMinutes: 35, difficulty: 'medium', servings: 3, tags: ['batch'],
  ingredients: [{ name: 'Arroz', quantityText: '250 g' }, { name: 'Pechuga de pollo', quantityText: '300 g' }, { name: 'Calabacín', quantityText: '1' }, { name: 'Cebolla', quantityText: '1' }],
  steps: ['Sofríe la cebolla y el pollo.', 'Añade el calabacín.', 'Echa el arroz y el doble de agua; 18 minutos.'],
});
const lentejas = recipe({
  name: 'Lentejas estofadas', timeMinutes: 50, difficulty: 'easy', servings: 4, tags: ['batch', 'legumbres'],
  ingredients: [{ name: 'Lentejas', quantityText: '300 g' }, { name: 'Patatas', quantityText: '2' }, { name: 'Cebolla', quantityText: '1' }, { name: 'Tomate', quantityText: '1' }],
  steps: ['Sofríe la verdura.', 'Añade lentejas, patata y agua.', 'Cuece 40 minutos.'],
});
const tortilla = recipe({
  name: 'Tortilla de patatas', source: 'user', timeMinutes: 40, difficulty: 'medium', servings: 2, isFavorite: true, tags: ['española'],
  ingredients: [{ name: 'Patatas', quantityText: '3' }, { name: 'Huevos', quantityText: '4' }, { name: 'Cebolla', quantityText: '1/2' }, { name: 'Aceite de oliva' }],
  steps: ['Fríe la patata y la cebolla a fuego lento.', 'Mezcla con el huevo batido.', 'Cuaja por los dos lados.'],
});
const pasta = recipe({
  name: 'Pasta con tomate y pollo', timeMinutes: 20, tags: ['rápida'],
  ingredients: [{ name: 'Pasta', quantityText: '100 g' }, { name: 'Tomate', quantityText: '2' }, { name: 'Pechuga de pollo', quantityText: '120 g' }],
  steps: ['Cuece la pasta.', 'Saltea el pollo con el tomate.', 'Mézclalo todo.'],
});

// History and feedback
const cooked = logCooked({ recipeId: ramen, title: 'Ramen casero', cookedAt: `${addDays(today, -6)}T20:00:00.000Z` });
addFeedback({ recipeId: ramen, cookedLogId: cooked, verdict: 'loved', isFirstTime: true });
const cooked2 = logCooked({ recipeId: lentejas, title: 'Lentejas estofadas', cookedAt: `${addDays(today, -9)}T13:00:00.000Z` });
addFeedback({ recipeId: lentejas, cookedLogId: cooked2, verdict: 'too_slow', note: 'Mejor el finde', isFirstTime: true });
const cooked3 = logCooked({ recipeId: tortilla, title: 'Tortilla de patatas', cookedAt: `${addDays(today, -4)}T20:00:00.000Z` });
addFeedback({ recipeId: tortilla, cookedLogId: cooked3, verdict: 'adjust', adjustments: ['simpler'], isFirstTime: false });

// Active menu for 7 days from the start of the cycle: [lunch, dinner, leftover of lunch?]
const menuId = createMenu({
  cycleId, startDate: start, days: 7, status: 'active',
  shoppingSuggestions: [
    { name: 'Pan de molde', quantity: '1 paquete', reason: 'Para las cenas rápidas' },
    { name: 'Calabacín', quantity: '2', reason: 'Para el arroz del sábado' },
  ],
});
const plan = [
  [garbanzos, ramen], [arroz, null], [pasta, ramenPollo], [lentejas, null], [garbanzos, tortilla], [arroz, null], [pasta, ramen],
];
const names = { [garbanzos]: 'Garbanzos salteados con huevo', [ramen]: 'Ramen casero', [arroz]: 'Arroz con pollo y verduras', [pasta]: 'Pasta con tomate y pollo', [ramenPollo]: 'Ramen con pollo', [lentejas]: 'Lentejas estofadas', [tortilla]: 'Tortilla de patatas' };
plan.forEach(([lunch, dinner], index) => {
  const date = addDays(start, index);
  const lunchSlot = addSlot({ menuId, date, mealType: 'lunch', recipeId: lunch, title: names[lunch], batchGroup: lunch === arroz || lunch === lentejas ? 'Cocinar una vez, comer dos' : null });
  // No dinner planned = leftovers of that day's lunch.
  if (dinner) addSlot({ menuId, date, mealType: 'dinner', recipeId: dinner, title: names[dinner] });
  else addSlot({ menuId, date, mealType: 'dinner', recipeId: lunch, title: names[lunch], isLeftover: true, leftoverOfSlotId: lunchSlot });
  if (date < today) {
    updateSlot(lunchSlot, { status: 'cooked' });
  }
});

for (const [name, quantity] of [['Pan de molde', '1 paquete'], ['Plátanos', '1 kg'], ['Yogures naturales', '8'], ['Detergente', null], ['Calabacín', '2']]) {
  addToList({ name, quantityText: quantity, source: 'manual' });
}

// A conversation with two cards to confirm.
addMessage({ role: 'user', content: 'Ya no me apetece nada la coliflor ni las lentejas entre semana. Y apúntame huevos, que me quedan pocos.', mode: 'chat' });
const reply = addMessage({
  role: 'assistant',
  content: 'Entendido. Te dejo abajo los cambios para que los confirmes: lo de las lentejas lo apunto como nota para proponerlas solo el finde.',
  mode: 'chat',
});
for (const raw of [
  { type: 'update_profile', addNotes: ['Lentejas solo el fin de semana'] },
  { type: 'add_to_shopping_list', items: [{ name: 'Huevos', quantity: '1 docena' }] },
]) {
  createAction({ messageId: reply.id, ...describeAction(raw) });
}

console.log(`Demo data written to ${demoDb}`);
