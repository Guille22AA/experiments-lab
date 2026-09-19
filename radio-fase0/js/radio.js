import { CONFIG } from "./config.js";

// La radio no guarda estado: la canción y el segundo que suenan se calculan
// a partir de la hora. Cualquiera que abra la web a la vez oye lo mismo.

export const DAY_KEYS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
export const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function partsInTz(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CONFIG.timezone, weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    day: WEEKDAY_INDEX[get("weekday")],
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    seconds: Number(get("second")),
  };
}

const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

// Parrilla completa: 7 días × franjas, con inicio/fin y datos del programa.
let week = null;
export function weekSchedule() {
  if (week) return week;
  week = DAY_KEYS.map((key, day) => {
    const slots = [...(CONFIG.schedule[key] || [])].sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
    return slots.map(([from, programKey], i) => {
      const program = CONFIG.programs[programKey];
      if (!program) console.warn(`Programa desconocido en ${key} ${from}: "${programKey}"`);
      const to = slots[i + 1]?.[0] || "24:00";
      return {
        key: `${key}-${from}`,
        day, from, to,
        fromMin: toMinutes(from),
        toMin: toMinutes(to),
        program: programKey,
        name: program?.name || programKey,
        genres: program?.genres || "",
        playlist: program?.id,
        mood: program?.mood,
      };
    });
  });
  return week;
}

export function currentBlock() {
  const now = partsInTz();
  const today = weekSchedule()[now.day];
  return today.find((b) => now.minutes >= b.fromMin && now.minutes < b.toMin) || today[0];
}

export function nextBlock() {
  const all = weekSchedule().flat();
  const i = all.indexOf(currentBlock());
  return all[(i + 1) % all.length];
}

function elapsedInBlock(block) {
  const now = partsInTz();
  return ((now.minutes - block.fromMin) * 60 + now.seconds) * 1000 + new Date().getMilliseconds();
}

// PRNG con semilla para que el "aleatorio" sea el mismo para todos.
function seededRandom(seedText) {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(list, seed) {
  const rand = seededRandom(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Devuelve la cola desde la canción que "está sonando ahora" y el offset dentro de ella.
// La semilla incluye fecha y hora de inicio: cada emisión del mismo programa suena distinta.
export function tuneIn(playlist, block, queueSize = 50) {
  const elapsed = elapsedInBlock(block);
  const order = seededShuffle(playlist.tracks, `${playlist.id}|${partsInTz().date}|${block.from}`);
  const total = order.reduce((sum, t) => sum + t.duration, 0);

  let position = elapsed % total;
  let index = 0;
  while (position >= order[index].duration) {
    position -= order[index].duration;
    index++;
  }
  const queue = [];
  for (let k = 0; k < Math.min(order.length, queueSize); k++) queue.push(order[(index + k) % order.length]);
  return { queue, offset: position };
}

export function clockText() {
  return new Intl.DateTimeFormat("es-ES", { timeZone: CONFIG.timezone, hour: "2-digit", minute: "2-digit" }).format(new Date());
}

export const todayInTz = () => partsInTz().date;
export const nowInTz = () => partsInTz();
