// Data access for known products ("learned" products).
// A product's section depends on the supermarket, so it lives in product_sections.
import { db } from '../connection.js';
import { nowIso, parseJson, toJson } from '../../lib/json.js';
import { normalizeName } from '../../lib/text.js';
import { getDefaultSupermarketId } from './sectionRepo.js';

// Product columns + its section in the given supermarket.
const SELECT_PRODUCT = `
  SELECT p.*, ps.section_id
  FROM products p
  LEFT JOIN product_sections ps ON ps.product_id = p.id AND ps.supermarket_id = @supermarketId`;

function rowToProduct(row) {
  return {
    id: row.id,
    name: row.name,
    aliases: parseJson(row.aliases, []),
    tags: parseJson(row.tags, []),
    tagsSource: row.tags_source,
    tagsConfirmed: Boolean(row.tags_confirmed),
    sectionId: row.section_id ?? null,
    approxPrice: row.approx_price,
    offBarcode: row.off_barcode,
  };
}

export function getProduct(id, supermarketId = getDefaultSupermarketId()) {
  const row = db.prepare(`${SELECT_PRODUCT} WHERE p.id = @id`).get({ id, supermarketId });
  return row ? rowToProduct(row) : null;
}

/** Finds a product by its name or by any alias seen before (e.g. ticket text). */
export function findProductByName(text, supermarketId = getDefaultSupermarketId()) {
  const normalized = normalizeName(text);
  if (!normalized) return null;
  const row =
    db.prepare(`${SELECT_PRODUCT} WHERE p.normalized_name = @normalized`).get({ normalized, supermarketId }) ??
    db
      .prepare(`${SELECT_PRODUCT} WHERE EXISTS (SELECT 1 FROM json_each(p.aliases) a WHERE a.value = @normalized)`)
      .get({ normalized, supermarketId });
  return row ? rowToProduct(row) : null;
}

/** Products whose name contains the query (for the search box). */
export function searchProducts(query, limit = 10, supermarketId = getDefaultSupermarketId()) {
  const normalized = normalizeName(query);
  return db
    .prepare(`${SELECT_PRODUCT} WHERE p.normalized_name LIKE @pattern ORDER BY
                (p.normalized_name LIKE @prefix) DESC, p.name LIMIT @limit`)
    .all({ pattern: `%${normalized}%`, prefix: `${normalized}%`, limit, supermarketId })
    .map(rowToProduct);
}

export function createProduct({ name, tags = [], tagsSource = null, sectionId = null }, supermarketId = getDefaultSupermarketId()) {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO products (name, normalized_name, tags, tags_source, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(name, normalizeName(name), toJson(tags), tagsSource, nowIso());
  if (sectionId) setProductSection(lastInsertRowid, sectionId, supermarketId);
  return getProduct(lastInsertRowid, supermarketId);
}

export function updateProduct(id, { name, tags, tagsSource }) {
  if (name !== undefined) {
    db.prepare('UPDATE products SET name = ?, normalized_name = ? WHERE id = ?').run(name, normalizeName(name), id);
  }
  if (tags !== undefined) {
    db.prepare('UPDATE products SET tags = ?, tags_source = ?, tags_confirmed = ? WHERE id = ?')
      .run(toJson(tags), tagsSource ?? 'manual', tagsSource === 'manual' ? 1 : 0, id);
  }
}

export function setProductSection(productId, sectionId, supermarketId = getDefaultSupermarketId()) {
  db.prepare(`INSERT INTO product_sections (product_id, supermarket_id, section_id) VALUES (?, ?, ?)
              ON CONFLICT (product_id, supermarket_id) DO UPDATE SET section_id = excluded.section_id`)
    .run(productId, supermarketId, sectionId);
}

/** Links the product to an Open Food Facts product (null = unlink). */
export function setProductOffLink(productId, barcode) {
  db.prepare('UPDATE products SET off_barcode = ? WHERE id = ?').run(barcode, productId);
}

/** Approximate unit price in euros (null = unknown). */
export function setApproxPrice(productId, price) {
  db.prepare('UPDATE products SET approx_price = ? WHERE id = ?').run(price, productId);
}

/** Remembers another name for the product (e.g. how it is written on the ticket). */
export function addAlias(productId, alias) {
  const normalized = normalizeName(alias);
  const product = db.prepare('SELECT normalized_name, aliases FROM products WHERE id = ?').get(productId);
  const aliases = parseJson(product.aliases, []);
  if (!normalized || normalized === product.normalized_name || aliases.includes(normalized)) return;
  db.prepare('UPDATE products SET aliases = ? WHERE id = ?').run(toJson([...aliases, normalized]), productId);
}

export function isNameTaken(name, exceptId = 0) {
  return Boolean(db.prepare('SELECT 1 FROM products WHERE normalized_name = ? AND id != ?').get(normalizeName(name), exceptId));
}
