// Rastrea los canales públicos de Telegram de scripts/carteles-fuentes.json y guarda en
// data/carteles-auto.json las convocatorias (manifestaciones, charlas, jornadas…) con foto
// y fecha futura. Lo ejecuta GitHub Actions una vez al día (ver .github/workflows/radio-carteles.yml).
//
// También rellena "hasta" en los carteles manuales (data/carteles.json) que no lo tengan,
// leyendo la fecha del propio texto. Con --test comprueba el lector de fechas con tus carteles.

import { readFile, writeFile } from "node:fs/promises";

const TZ = "Europe/Madrid";
const SOURCES = JSON.parse(await readFile(new URL("./carteles-fuentes.json", import.meta.url), "utf8"));
const AUTO = new URL("../data/carteles-auto.json", import.meta.url);
const MANUAL = new URL("../data/carteles.json", import.meta.url);
const MAX_AUTO = 12;

const norm = (s = "") => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const todayIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

// ── Lector de fechas ─────────────────────────────────────────

const MONTHS = { ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6, jul: 7, julio: 7,
  ago: 8, agosto: 8, sep: 9, sept: 9, set: 9, septiembre: 9, setiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12 };
const WEEKDAY = "lunes|martes|miercoles|jueves|viernes|sabado|domingo";
const MONTH_RE = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

// Devuelve la primera fecha de evento (ISO) que aparezca en el texto, o null.
// "ref" es la fecha del mensaje: sirve para deducir el año cuando no viene.
export function eventDate(text, ref) {
  const t = norm(text);
  const [ry, rm, rd] = ref.split("-").map(Number);
  const refTime = Date.UTC(ry, rm - 1, rd);
  const found = [];

  const pushDay = (day, month, year) => {
    if (day < 1 || day > 31 || month < 1 || month > 12) return;
    let y = year ? (year < 100 ? 2000 + year : year) : ry;
    let time = Date.UTC(y, month - 1, day);
    if (!year && time < refTime - 7 * 864e5) { y++; time = Date.UTC(y, month - 1, day); }
    if (new Date(time).getUTCDate() !== day) return; // 31 de febrero, etc.
    found.push({ index: 0, date: iso(y, month, day) });
  };

  const collect = (re, fn) => { for (const m of t.matchAll(re)) { const before = found.length; fn(m); for (let i = before; i < found.length; i++) found[i].index = m.index; } };

  // 19 sep · 19 de septiembre · 19 de septiembre de 2026
  collect(new RegExp(`\\b(\\d{1,2})\\s*(?:de\\s+)?(${MONTH_RE})\\b\\.?(?:\\s*(?:de\\s+)?(\\d{4}))?`, "g"),
    (m) => pushDay(Number(m[1]), MONTHS[m[2]], m[3] && Number(m[3])));
  // 19/09 · 19-09-2026 (con barra o guion; con punto se confunde con decimales)
  collect(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/g,
    (m) => pushDay(Number(m[1]), Number(m[2]), m[3] && Number(m[3])));
  // "el sábado 27": sin mes, se toma el primer mes en que ese día de la semana coincide.
  collect(new RegExp(`\\b(${WEEKDAY})\\s+(?:dia\\s+)?(\\d{1,2})\\b`, "g"), (m) => {
    const wd = WEEKDAY.split("|").indexOf(m[1]); // 0 = lunes
    const day = Number(m[2]);
    for (let k = 0; k < 4; k++) {
      const d = new Date(Date.UTC(ry, rm - 1 + k, day));
      if (d.getUTCDate() === day && (d.getUTCDay() + 6) % 7 === wd && d.getTime() >= refTime - 864e5) {
        found.push({ index: m.index, date: iso(d.getUTCFullYear(), d.getUTCMonth() + 1, day) });
        return;
      }
    }
  });

  found.sort((a, b) => a.index - b.index);
  return found[0]?.date ?? null;
}

// ── Qué es una convocatoria ──────────────────────────────────

// Solo palabras que indican un acto concreto. "Jornada laboral" y "día internacional de…" no lo son.
const CONVOCATORIA = /\b(convoca\w*|concentraci\w+|manifestaci\w+|marcha|movilizaci\w+|cacerolada|mitin|huelga\w*|charla\w*|jornadas?|asamblea\w*|acampada|piquete|homenaje)\b/;
const NO_ES_ACTO = /(jornada (laboral|de trabajo|completa|parcial|intensiva)|(reduccion|semana) de (la )?jornada|dia (internacional|mundial|nacional|europeo) de)/;
const esConvocatoria = (plain) => { const t = norm(plain).replace(new RegExp(NO_ES_ACTO, "g"), " "); return CONVOCATORIA.test(t); };

// ── Telegram ─────────────────────────────────────────────────

const decode = (s) => s
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<[^>]+>/g, "")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/\s+/g, " ").trim();

const trim = (s, max) => (s.length <= max ? s : s.slice(0, s.lastIndexOf(" ", max)).replace(/[,;:.\s]+$/, "") + "…");

async function readChannel(source) {
  const r = await fetch(`https://t.me/s/${source.telegram}`, { headers: { "User-Agent": "Mozilla/5.0 (compatible; RadioFase0-Bot/1.0)" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const out = [];
  for (const block of html.split("tgme_widget_message_wrap").slice(1)) {
    const post = block.match(/data-post="([^"]+)"/)?.[1];
    const day = block.match(/<time[^>]*datetime="(\d{4}-\d{2}-\d{2})/)?.[1];
    const photo = block.match(/tgme_widget_message_photo_wrap[^>]*background-image:url\('([^']+)'\)/)?.[1];
    const text = block.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)?.[1];
    if (!post || !day || !photo || !text) continue;
    const plain = decode(text);
    if (!esConvocatoria(plain)) continue;
    const date = eventDate(plain, day);
    if (!date) continue;
    out.push({ id: post, imagen: photo, texto: trim(plain, 240), enlace: `https://t.me/${post}`, fuente: source.name, fecha: date, hasta: date });
  }
  return out;
}

// ── Modo prueba ──────────────────────────────────────────────

if (process.argv.includes("--test")) {
  const manual = JSON.parse(await readFile(MANUAL, "utf8"));
  for (const c of manual) console.log(`${eventDate(c.texto || "", c.desde || todayIso()) ?? "SIN FECHA"}  ←  ${c.texto?.slice(0, 90)}`);
  const cases = [
    ["Concentración el sábado 26 a las 12:00 en Sol", "2026-09-22", "2026-09-26"],
    ["Manifestación 5 de octubre de 2026", "2026-09-22", "2026-10-05"],
    ["Charla el 12/11 en Vallecas", "2026-09-22", "2026-11-12"],
    ["Jornada 3 dic, 18h", "2026-11-20", "2026-12-03"],
    ["Huelga general 14 de enero", "2026-12-20", "2027-01-14"],
    ["Subida del 23,4% en 2026", "2026-09-22", null],
  ];
  for (const [text, ref, want] of cases) {
    const got = eventDate(text, ref);
    console.log(got === want ? "ok " : "MAL", got, "←", text);
  }
  process.exit(0);
}

// ── Ejecución diaria ─────────────────────────────────────────

const today = todayIso();
let previous = [];
try { previous = JSON.parse(await readFile(AUTO, "utf8")); } catch { /* primera vez */ }

const fresh = [];
const failed = new Set();
for (const source of SOURCES) {
  try {
    const found = await readChannel(source);
    fresh.push(...found);
    console.log(`✓ ${source.name}: ${found.length} convocatorias`);
  } catch (e) {
    failed.add(source.name);
    console.warn(`✗ ${source.name}: ${e.message}`);
  }
}

// Se conservan las de ayer que aún no han pasado (aunque el canal ya no las muestre).
const byId = new Map();
for (const c of [...previous, ...fresh]) byId.set(c.id, c);
const list = [...byId.values()]
  .filter((c) => c.hasta >= today)
  .sort((a, b) => a.fecha.localeCompare(b.fecha))
  .slice(0, MAX_AUTO);
await writeFile(AUTO, JSON.stringify(list, null, 2) + "\n");
console.log(`${list.length} carteles automáticos vigentes (${previous.length - previous.filter((c) => c.hasta >= today).length} caducados).`);

// Carteles manuales sin "hasta": se deduce del texto.
try {
  const manual = JSON.parse(await readFile(MANUAL, "utf8"));
  let changed = 0;
  for (const c of manual) {
    if (c.hasta || !c.texto) continue;
    const d = eventDate(c.texto, c.desde || today);
    if (d) { c.hasta = d; changed++; }
  }
  if (changed) {
    await writeFile(MANUAL, JSON.stringify(manual, null, 2) + "\n");
    console.log(`${changed} cartel(es) manual(es) con "hasta" deducido del texto.`);
  }
} catch { /* sin carteles manuales */ }
