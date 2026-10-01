// Cache of Open Food Facts answers, so the same search or barcode is not asked twice.
import { db } from '../connection.js';
import { nowIso, parseJson, toJson } from '../../lib/json.js';

/** Cached value if it is younger than `maxAgeDays`, otherwise null. */
export function getCached(key, maxAgeDays) {
  const row = db.prepare('SELECT data, fetched_at FROM off_cache WHERE cache_key = ?').get(key);
  if (!row) return null;
  const ageDays = (Date.now() - new Date(row.fetched_at).getTime()) / 86_400_000;
  return ageDays <= maxAgeDays ? parseJson(row.data, null) : null;
}

export function setCached(key, data) {
  db.prepare(`INSERT INTO off_cache (cache_key, data, fetched_at) VALUES (?, ?, ?)
              ON CONFLICT (cache_key) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`)
    .run(key, toJson(data), nowIso());
}
