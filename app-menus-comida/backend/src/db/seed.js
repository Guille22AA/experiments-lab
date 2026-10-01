// Initial data: Mercadona with its sections and the single profile row.
// Only inserts what is missing, so it is safe to run on every start.

const MERCADONA_SECTIONS = [
  'Fruta y verdura',
  'Carne',
  'Pescado',
  'Charcutería y quesos',
  'Panadería',
  'Lácteos y huevos',
  'Despensa',
  'Conservas',
  'Congelados',
  'Bebidas',
  'Droguería y limpieza',
  'Higiene',
];

export function seed(db) {
  let mercadona = db.prepare('SELECT id FROM supermarkets WHERE name = ?').get('Mercadona');

  if (!mercadona) {
    const { lastInsertRowid } = db.prepare('INSERT INTO supermarkets (name) VALUES (?)').run('Mercadona');
    mercadona = { id: lastInsertRowid };
    const insertSection = db.prepare('INSERT INTO sections (supermarket_id, name, position) VALUES (?, ?, ?)');
    MERCADONA_SECTIONS.forEach((name, index) => insertSection.run(mercadona.id, name, index + 1));
  }

  db.prepare('INSERT OR IGNORE INTO profile (id, default_supermarket_id) VALUES (1, ?)').run(mercadona.id);
}
