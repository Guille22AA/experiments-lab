// La estructura de la web nunca cambia: solo cambian variables CSS.
// 1) mood de la playlist → tipografías, fondo, textura, forma  (css/themes.css)
// 2) portada de cada canción → color de acento y "luz" de fondo

const FONTS = {
  neutral: "family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;600",
  fiesta: "family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800",
  melancolia: "family=Cormorant+Garamond:ital,wght@1,500&family=Newsreader:opsz,wght@6..72,400;6..72,600",
  rabia: "family=Anton&family=Courier+Prime:wght@400;700",
  calma: "family=Fraunces:opsz,wght,SOFT@9..144,400,100;9..144,600,100&family=Figtree:wght@400;600",
  electronica: "family=Unbounded:wght@500;800&family=IBM+Plex+Mono:wght@400;600",
  rap: "family=Big+Shoulders+Display:wght@800;900&family=Archivo:wght@400;600",
  sensual: "family=Bodoni+Moda:ital,opsz,wght@1,6..96,500&family=Libre+Franklin:wght@400;600",
  bar: "family=Limelight&family=Crimson+Pro:wght@400;600",
  retro: "family=Righteous&family=Rubik:wght@400;600",
};

// Palabras clave (sin tildes, en minúscula) que empujan hacia cada mood.
const RULES = {
  fiesta: ["fiesta", "party", "perreo", "reggaeton", "dembow", "cumbia", "salsa", "bachata", "baile", "bailar", "dance", "verano", "summer", "latin", "pop", "disco", "funk", "house", "guaracha", "merengue"],
  melancolia: ["melanc", "triste", "sad", "lluvia", "rain", "otono", "autumn", "noche", "night", "slowcore", "shoegaze", "emo", "dream", "indie", "alternative", "alternativo", "post-rock", "post-punk", "llorar", "nostalg", "invierno", "dark"],
  rabia: ["punk", "hardcore", "rabia", "protesta", "lucha", "combat", "metal", "grunge", "thrash", "oi!", "rock duro", "hard rock", "crust", "ska punk", "rock radical", "antifa"],
  calma: ["chill", "lofi", "lo-fi", "relax", "calma", "estudiar", "study", "ambient", "bossa", "soul", "acoustic", "acustic", "folk", "domingo", "sunday", "cafe", "morning", "manana"],
  electronica: ["techno", "electr", "rave", "club", "edm", "trance", "synth", "dnb", "drum and bass", "jungle", "industrial", "ebm", "hyperpop", "breakbeat", "dubstep", "garage"],
  rap: ["rap", "hip hop", "hip-hop", "trap", "drill", "boom bap", "grime", "freestyle", "urbano"],
  sensual: ["sensual", "erot", "romant", "besito", "love", "amor", "r&b", "rnb", "femme", "slow jam"],
  bar: ["jazz", "bebop", "swing", "bolero", "flamenco", "whisk", "blues", "tango", "copla"],
  retro: ["city pop", "eurobeat", "eurodance", "anime", "j-pop", "jpop", "j-rock", "jrock", "80s", "90s", "retro", "vintage", "italo"],
};

const loadedFonts = new Set();
const norm = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function loadFonts(mood) {
  if (loadedFonts.has(mood) || !FONTS[mood]) return;
  loadedFonts.add(mood);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${FONTS[mood]}&display=swap`;
  document.head.append(link);
}

export function applyMood(mood) {
  const safe = FONTS[mood] ? mood : "neutral";
  loadFonts(safe);
  document.documentElement.dataset.mood = safe;
  setAccent(lastCover); // re-evaluar el color de la portada contra el nuevo fondo
  return safe;
}

function scoreText(text, weight = 1) {
  const n = norm(text);
  const scores = {};
  for (const [mood, words] of Object.entries(RULES)) {
    scores[mood] = words.reduce((acc, w) => acc + (n.includes(w) ? weight : 0), 0);
  }
  return scores;
}

// Artistas más repetidos de la playlist (son los que mejor la definen).
function topArtistIds(tracks, n = 8) {
  const count = new Map();
  for (const t of tracks) for (const a of t.artists) if (a.id) count.set(a.id, (count.get(a.id) || 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id]) => id);
}

export async function detectMood(block, playlist, getGenres) {
  if (block.mood) return block.mood;
  const total = scoreText(`${playlist.name} ${playlist.description}`, 3);
  try {
    const genres = await getGenres(topArtistIds(playlist.tracks));
    for (const g of genres) {
      const s = scoreText(g);
      for (const k in s) total[k] += s[k];
    }
  } catch { /* sin géneros: nos quedamos con nombre y descripción */ }
  const [best, score] = Object.entries(total).sort((a, b) => b[1] - a[1])[0];
  return score > 0 ? best : "neutral";
}

// ── Color de la portada ──────────────────────────────────────

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [s, l];
}

let lastCover = null; // [r, g, b] de la última portada

const luminance = ([r, g, b]) => {
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
function currentBg() {
  const hex = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128];
}

function setAccent(rgb) {
  const root = document.documentElement;
  // Sin color, o un color que se pierde sobre el fondo del tema: se queda el acento del tema.
  if (!rgb || contrast(rgb, currentBg()) < 1.9) {
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-ink");
    return;
  }
  root.style.setProperty("--accent", `rgb(${rgb.join(" ")})`);
  root.style.setProperty("--accent-ink", luminance(rgb) > 0.3 ? "#121212" : "#ffffff");
}

export async function applyCover(url) {
  lastCover = null;
  if (!url) return setAccent(null);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    const size = 40;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    // Nos quedamos con los píxeles más saturados y de luz media: el color "con carácter".
    const px = [];
    for (let i = 0; i < data.length; i += 4) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      const [s, l] = rgbToHsl(r, g, b);
      px.push({ r, g, b, score: s * (1 - Math.abs(l - 0.5) * 1.6) });
    }
    px.sort((a, b) => b.score - a.score);
    const top = px.slice(0, Math.max(8, Math.floor(px.length * 0.12)));
    if (top[0].score < 0.12) return setAccent(null); // portada en blanco y negro
    const avg = (k) => Math.round(top.reduce((acc, p) => acc + p[k], 0) / top.length);
    lastCover = [avg("r"), avg("g"), avg("b")];
    setAccent(lastCover);
  } catch {
    setAccent(null);
  }
}
