// Contexto breve del artista que suena.
// Prioridad: 1) tus notas en data/notas.json  2) Genius  3) Wikipedia en español  4) Wikipedia en inglés.

import { CONFIG } from "./config.js";

const LANGS = ["es", "en"];
const MUSIC_WORDS = /(banda|grupo|cantante|músic|music|rapero|rapera|cantautor|compositor|compositora|\bdj\b|productor|productora|orquesta|dúo|band|singer|musician|rapper|songwriter|producer|duo)/i;

const cache = new Map();
let notesPromise;

const norm = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function loadNotes() {
  notesPromise ??= fetch(`data/notas.json?t=${Date.now()}`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return notesPromise;
}

function shorten(text, min = 240, max = 440) {
  if (!text || text.length <= max) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  let out = "";
  for (const s of sentences) {
    if (out.length >= min || out.length + s.length > max) break;
    out += s;
  }
  return (out || text.slice(0, max)).trim();
}

async function summary(lang, title) {
  try {
    const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.type === "disambiguation" || !j.extract) return null;
    return { text: shorten(j.extract), description: j.description || "", url: j.content_urls?.desktop?.page, source: `Wikipedia (${lang})` };
  } catch { return null; }
}

async function search(lang, query) {
  try {
    const u = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=4&format=json&origin=*&srsearch=${encodeURIComponent(query)}`;
    const r = await fetch(u);
    if (!r.ok) return [];
    return (await r.json()).query?.search?.map((s) => s.title) ?? [];
  } catch { return []; }
}

// Genius: busca canciones del artista, toma su primary_artist y lee la descripción.
async function genius(path, params = {}) {
  const qs = new URLSearchParams({ ...params, access_token: CONFIG.geniusToken });
  const r = await fetch(`https://api.genius.com/${path}?${qs}`);
  if (!r.ok) throw new Error(`Genius ${r.status}`);
  return (await r.json()).response;
}

// Sin tildes, mayúsculas, espacios ni signos: "L'haine", "L’Haine" y "L haine" son el mismo nombre.
const key = (s = "") => norm(s).replace(/[^a-z0-9]/g, "");

async function findGenius(name, trackTitle) {
  if (!CONFIG.geniusToken) return null;
  try {
    // Primero canción + artista (acierta casi siempre), luego solo el artista.
    const queries = [...new Set([trackTitle && `${trackTitle} ${name}`, name, name.replace(/[^\p{L}\p{N}\s]/gu, " ")].filter(Boolean))];
    let artist = null;
    const seen = [];
    for (const q of queries) {
      const { hits } = await genius("search", { q });
      const people = hits.flatMap((h) => [h.result.primary_artist, ...(h.result.featured_artists || [])]).filter(Boolean);
      artist = people.find((a) => key(a.name) === key(name));
      if (artist) break;
      seen.push(...people.map((a) => a.name));
    }
    if (!artist) { console.warn(`[Genius] sin coincidencia para "${name}"; candidatos:`, [...new Set(seen)]); return null; }
    const { artist: full } = await genius(`artists/${artist.id}`, { text_format: "plain" });
    const text = full.description?.plain?.trim();
    if (!text || text === "?") { console.warn(`[Genius] "${name}" no tiene descripción`); return null; }
    return { text: shorten(text), url: full.url, source: "Genius" };
  } catch (e) { console.warn("[Genius] error:", e); return null; }
}

async function findArtist(name, trackTitle) {
  const g = await findGenius(name, trackTitle);
  if (g) return g;
  for (const lang of LANGS) {
    const direct = await summary(lang, name);
    if (direct && MUSIC_WORDS.test(`${direct.description} ${direct.text}`)) return direct;
    const hint = lang === "es" ? "grupo música cantante" : "band musician";
    for (const candidate of (await search(lang, `${name} ${hint}`)).slice(0, 2)) {
      if (!norm(candidate).includes(norm(name))) continue;
      const s = await summary(lang, candidate);
      if (s && MUSIC_WORDS.test(`${s.description} ${s.text}`)) return s;
    }
  }
  return null;
}

export async function getContext(track) {
  const key = track.artists[0]?.name || track.uri;
  if (cache.has(key)) return cache.get(key);

  const job = (async () => {
    const notes = await loadNotes();
    const artistName = track.artists[0]?.name || "";
    const myArtist = notes.artistas?.[artistName];

    const artist = myArtist ? { text: myArtist, source: "Nota de la radio" } : await findArtist(artistName, track.name);
    return { artist, artistName };
  })();

  cache.set(key, job);
  return job;
}
