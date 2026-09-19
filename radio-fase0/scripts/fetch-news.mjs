// Genera data/news.json a partir de feeds RSS.
// Lo ejecuta GitHub Actions 3 veces al día (ver .github/workflows/radio-news.yml).
//
// "Destacadas": noticias que cubren varios medios a la vez. Se conservan
// durante todo el día aunque cambie la edición, y se reordenan si crecen.
// Se calculan por sección (España, Mundo); cada feed indica la suya en feeds.json.

import Parser from "rss-parser";
import { readFile, writeFile } from "node:fs/promises";

const TZ = "Europe/Madrid";
const OUT = new URL("../data/news.json", import.meta.url);
const FEEDS = JSON.parse(await readFile(new URL("./feeds.json", import.meta.url), "utf8"));
const MAX_HIGHLIGHTS = 5;
const MAX_LATEST = 8;
const MAX_AGE_HOURS = 18;
const SIMILARITY = 0.3;
// Orden de las secciones. "mundo" se procesa primero para que sus noticias no se repitan en España.
const SECTIONS = [
  { id: "espana", title: "España" },
  { id: "mundo", title: "Mundo · Geopolítica" },
];

const STOP = new Set(("para como sobre entre desde hasta tras ante contra durante segun este esta estos estas " +
  "pero porque cuando donde quien cual cuales tiene tienen hace hacen sera seran puede pueden ha han " +
  "del los las una unos unas que por con sin mas muy ya hoy ayer tambien todo todos toda todas otro otra " +
  "dice dicen asegura afirma tras despues antes sus ese esa eso nuevo nueva gobierno").split(" "));

const norm = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const tokens = (text) => new Set(norm(text).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)));
const jaccard = (a, b) => {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter || 1);
};
const clean = (s = "") => s.replace(/\s+/g, " ").trim();
// Corta por palabra, no a mitad, y marca que hay más.
const truncate = (s, max) => {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
};

function tzParts(date = new Date()) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: Number(g("hour")) };
}

// ── 1. Descargar ─────────────────────────────────────────────

const parser = new Parser({
  timeout: 15000,
  headers: {
    "User-Agent": "Mozilla/5.0 (compatible; RadioFase0-NewsBot/1.0)",
    Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
  },
});

// Solo temas serios: ver scripts/temas.json.
const TEMAS = JSON.parse(await readFile(new URL("./temas.json", import.meta.url), "utf8"));
const wordRe = (list) => new RegExp(`\\b(?:${list.map((w) => norm(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`);
const INCLUDE = new RegExp(wordRe(TEMAS.incluir).source, "g");
const EXCLUDE = wordRe(TEMAS.excluir);
// Al menos dos temas distintos y ninguna palabra excluida: una sola palabra suelta ("empleo") no basta.
const isSerious = (it) => {
  const text = `${norm(it.title)} ${norm(it.summary)} `;
  return new Set(text.match(INCLUDE)).size >= 2 && !EXCLUDE.test(text);
};

const cutoff = Date.now() - MAX_AGE_HOURS * 3600 * 1000;
let items = [];

for (const feed of FEEDS) {
  try {
    const parsed = await parser.parseURL(feed.url);
    for (const it of parsed.items.slice(0, 40)) {
      const published = it.isoDate || it.pubDate;
      const time = published ? new Date(published).getTime() : Date.now();
      if (Number.isNaN(time) || time < cutoff || !it.title || !it.link) continue;
      items.push({
        // Google News añade " - Medio" al final del titular
        title: clean(it.title).replace(new RegExp(`\\s+-\\s+${feed.name}$`), ""),
        link: it.link,
        source: feed.name,
        section: feed.section || "espana",
        published: new Date(time).toISOString(),
        summary: truncate(clean(it.contentSnippet || ""), 600),
        tokens: tokens(it.title),
      });
    }
    console.log(`✓ ${feed.name}`);
  } catch (e) {
    console.warn(`✗ ${feed.name}: ${e.message}`);
  }
}
const total = items.length;
items = items.filter(isSerious);
items.sort((a, b) => b.published.localeCompare(a.published));
if (!items.length) {
  console.error("No se ha podido leer ningún feed. Se mantiene el boletín anterior.");
  process.exit(0);
}

// ── 2. Agrupar la misma noticia contada por distintos medios ──

const toHighlight = (c, firstSeen) => {
  const lead = c.members.find((m) => m.summary) || c.members[0];
  return {
    title: lead.title,
    link: lead.link,
    source: lead.source,
    summary: lead.summary,
    sources: [...new Set(c.members.map((m) => m.source))],
    firstSeen,
  };
};

const now = new Date();
const { date: today, hour } = tzParts(now);

let previous = {};
try {
  const old = JSON.parse(await readFile(OUT, "utf8"));
  if (old.date === today) previous = Object.fromEntries((old.sections || []).map((s) => [s.id, (s.highlights || []).filter(isSerious)]));
} catch { /* primera ejecución */ }

// Tokens de todo lo ya publicado en secciones anteriores, para no repetir noticias entre secciones.
const taken = [];

function buildSection(id, sectionItems) {
  const clusters = [];
  for (const item of sectionItems) {
    let best = null;
    let bestScore = 0;
    for (const c of clusters) {
      const score = Math.max(...c.members.map((m) => jaccard(m.tokens, item.tokens)));
      if (score > bestScore) { best = c; bestScore = score; }
    }
    if (best && bestScore >= SIMILARITY) best.members.push(item);
    else clusters.push({ members: [item] });
  }

  const fresh = clusters
    .filter((c) => new Set(c.members.map((m) => m.source)).size >= 2)
    .map((c) => toHighlight(c, now.toISOString()));

  // ── 3. Mezclar con las destacadas que ya había hoy ──
  const merged = (previous[id] || []).map((p) => ({ ...p }));
  for (const h of fresh) {
    const t = tokens(h.title);
    const match = merged.find((p) => jaccard(tokens(p.title), t) >= SIMILARITY);
    if (match) {
      match.sources = [...new Set([...match.sources, ...h.sources])];
      if (!match.summary && h.summary) match.summary = h.summary;
    } else {
      merged.push(h);
    }
  }
  merged.sort((a, b) => b.sources.length - a.sources.length || a.firstSeen.localeCompare(b.firstSeen));
  const highlights = merged.slice(0, MAX_HIGHLIGHTS);

  // ── 4. Última hora: lo más reciente que no está en destacadas ──
  const seen = highlights.map((h) => tokens(h.title));
  const latest = [];
  for (const item of sectionItems) {
    if (seen.some((t) => jaccard(t, item.tokens) >= SIMILARITY)) continue;
    seen.push(item.tokens);
    latest.push({ title: item.title, link: item.link, source: item.source, published: item.published });
    if (latest.length >= MAX_LATEST) break;
  }

  taken.push(...highlights.map((h) => tokens(h.title)), ...latest.map((l) => tokens(l.title)));
  return { highlights, items: latest };
}

// ── 5. Guardar ───────────────────────────────────────────────

const sections = [];
for (const s of [...SECTIONS].reverse()) {
  const own = items.filter((i) => i.section === s.id && !taken.some((t) => jaccard(t, i.tokens) >= SIMILARITY));
  sections.push({ ...s, ...buildSection(s.id, own) });
}
sections.sort((a, b) => SECTIONS.findIndex((s) => s.id === a.id) - SECTIONS.findIndex((s) => s.id === b.id));

const edition = hour < 11 ? "mañana" : hour < 17 ? "mediodía" : "tarde";
const out = { date: today, updatedAt: now.toISOString(), edition, sections };
await writeFile(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`Boletín ${edition}: ${sections.map((s) => `${s.title}: ${s.highlights.length} destacadas + ${s.items.length}`).join(" | ")} (${items.length} de ${total} noticias leídas pasan el filtro de temas).`);
