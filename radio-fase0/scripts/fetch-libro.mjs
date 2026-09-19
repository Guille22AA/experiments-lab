// Elige el "Libro del día" al azar entre los archivos de una carpeta pública de Google Drive
// y lo guarda en data/libro.json. Lo ejecuta GitHub Actions una vez al día (radio-libro.yml).
//
// La carpeta tiene que estar compartida como "cualquier persona con el enlace". No hace falta
// clave de API: se lee la vista embebida de la carpeta (https://drive.google.com/embeddedfolderview).
// Es una página sin documentar de Google; si algún día cambia, el script falla y se mantiene el libro anterior.

import { readFile, writeFile } from "node:fs/promises";

const FOLDER_ID = "1F38_rDQpW7zzki8QpPBjSTsN4rwZsNHM";
const OUT = new URL("../data/libro.json", import.meta.url);
const REMEMBER = 60; // no se repite un libro hasta pasados tantos días

const TZ = "Europe/Madrid";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

const decode = (s) => s
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/\s+/g, " ").trim();

let previous = {};
try { previous = JSON.parse(await readFile(OUT, "utf8")); } catch { /* primera vez */ }
if (previous.fecha === today) { console.log("El libro de hoy ya está elegido:", previous.titulo); process.exit(0); }

const r = await fetch(`https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}`, {
  headers: { "User-Agent": "Mozilla/5.0 (compatible; RadioFase0-Bot/1.0)" },
  signal: AbortSignal.timeout(30000),
});
if (!r.ok) { console.error(`Drive respondió ${r.status}. Se mantiene el libro anterior.`); process.exit(0); }
const html = await r.text();

const files = [...html.matchAll(/<div class="flip-entry" id="entry-([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g)]
  .map((m) => ({ id: m[1], name: decode(m[2]) }));
if (!files.length) { console.error("No se ha podido leer la carpeta (¿sigue compartida?). Se mantiene el libro anterior."); process.exit(0); }

const recent = new Set((previous.historial || []).slice(-REMEMBER));
const pool = files.filter((f) => !recent.has(f.id));
const pick = (pool.length ? pool : files)[Math.floor(Math.random() * (pool.length || files.length))];

// "Autor - Título.pdf" → autor y título
const base = pick.name.replace(/\.(pdf|pff|epub)$/i, "");
const cut = base.indexOf(" - ");
const libro = {
  fecha: today,
  id: pick.id,
  autor: cut > 0 ? base.slice(0, cut).trim() : "",
  titulo: cut > 0 ? base.slice(cut + 3).trim() : base,
  archivo: pick.name,
  total: files.length,
  historial: [...(previous.historial || []).filter((id) => id !== pick.id), pick.id].slice(-REMEMBER),
};
await writeFile(OUT, JSON.stringify(libro, null, 2) + "\n");
console.log(`Libro del día: ${libro.autor ? libro.autor + " — " : ""}${libro.titulo} (${files.length} en la carpeta).`);
