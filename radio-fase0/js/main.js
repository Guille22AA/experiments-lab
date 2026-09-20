import { CONFIG } from "./config.js";
import * as spotify from "./spotify.js";
import { currentBlock, tuneIn, clockText } from "./radio.js";
import { detectMood, applyMood, applyCover } from "./theme.js";
import { getContext } from "./context.js";
import { startNews, startCarteles, startTablon, startLibro } from "./panels.js";
import { startParrilla } from "./parrilla.js";

const $ = (s) => document.querySelector(s);
const ui = {
  station: $(".station-name"),
  onair: $(".onair"),
  onairLabel: $(".onair-label"),
  slot: $(".slot-label"),
  clock: $(".clock"),
  cover: $(".cover img"),
  playlist: $(".playlist-text"),
  playlistLink: $(".playlist-link"),
  title: $(".title"),
  artist: $(".artist"),
  album: $(".album"),
  fill: $(".progress-fill"),
  upNext: $(".up-next"),
  toggle: $(".btn-toggle"),
  volume: $(".volume"),
  volumeHint: $(".volume-hint"),
  artistTitle: $(".ctx-artist h2"),
  artistText: $(".ctx-artist .ctx-text"),
  artistSrc: $(".ctx-artist .ctx-src"),
  tuner: $(".tuner"),
  tunerMsg: $(".tuner-msg"),
  tunerBtn: $(".tuner-btn"),
  tunerLogout: $(".tuner-logout"),
};

let playerReady = null; // Promise<{player, deviceId}>
let player = null;
let deviceId = null;
let block = null;
let playlist = null;
let live = false;
let blockTimer = null;
let lastTrackKey = null;
const progress = { pos: 0, dur: 1, at: 0, paused: true };

// ── Arranque ────────────────────────────────────────────────

document.title = CONFIG.stationName;
ui.station.textContent = CONFIG.stationName;
applyMood("neutral");
startNews($(".boletin"));
startCarteles($(".cartel"));
startTablon($(".tablon"));
startLibro($(".libro"));
startParrilla($(".parrilla"), (now, next) => {
  ui.slot.textContent = now.name;
  ui.upNext.textContent = `A las ${next.from}: ${next.name}`;
});
const tick = () => { ui.clock.textContent = clockText(); };
tick();
setInterval(tick, 1000);
ui.volume.value = CONFIG.volume;
ui.volumeHint.hidden = CONFIG.volume > 0;

boot();

async function boot() {
  if (CONFIG.spotifyClientId.startsWith("PEGA_")) {
    return showTuner("config", "Falta el Client ID de Spotify en js/config.js.");
  }
  try {
    await spotify.handleRedirect();
  } catch (e) {
    return showTuner("login", e.message);
  }
  if (!spotify.hasSession()) return showTuner("login");
  preparePlayer();
  showTuner("tune");
}

function preparePlayer() {
  playerReady ??= spotify.createPlayer(onPlayerState).then((r) => {
    ({ player, deviceId } = r);
    return r;
  });
  playerReady.catch(() => {});
}

// ── Pantalla de sintonizar ──────────────────────────────────

function showTuner(mode, message = "") {
  ui.tuner.hidden = false;
  ui.tuner.dataset.mode = mode;
  ui.tunerMsg.textContent = message || {
    config: "",
    login: "Conecta tu cuenta de Spotify Premium para escuchar la emisión.",
    tune: "La emisión ya está en marcha. Entra cuando quieras.",
  }[mode];
  ui.tunerBtn.hidden = mode === "config";
  ui.tunerBtn.textContent = mode === "login" ? "Conectar con Spotify" : "Sintonizar";
  ui.tunerLogout.hidden = mode !== "tune";
  ui.tunerBtn.disabled = false;
  if (mode !== "config") ui.tunerBtn.focus();
}

ui.tunerBtn.addEventListener("click", async () => {
  if (ui.tuner.dataset.mode === "login") return spotify.login();
  player?.activateElement?.(); // Safari necesita que esto ocurra dentro del clic
  ui.tunerBtn.disabled = true;
  ui.tunerMsg.textContent = "Buscando la señal…";
  try {
    await playerReady;
    player.activateElement?.();
    await goLive();
    ui.tuner.hidden = true;
    blockTimer ??= setInterval(checkBlock, 20000);
  } catch (e) {
    showTuner("tune", friendlyError(e));
  }
});

ui.tunerLogout.addEventListener("click", () => {
  spotify.logout();
  location.reload();
});

function friendlyError(e) {
  if (e.kind === "account_error" || /premium/i.test(e.message)) return "Para escuchar en el navegador hace falta Spotify Premium.";
  if (e.kind === "authentication_error") return "Spotify no ha aceptado la sesión. Cierra sesión y vuelve a conectar.";
  if (e.kind === "initialization_error") return "Este navegador no puede reproducir Spotify. Prueba con Chrome, Firefox o Edge en un ordenador.";
  if (e.status === 403) return "Spotify ha denegado el acceso. Comprueba que la playlist es tuya y que tu cuenta está en la lista de usuarios de la app.";
  if (e.status === 404) return "No encuentro esa playlist. Revisa el ID en js/config.js.";
  return e.message || "Algo ha fallado al sintonizar.";
}

// ── Directo ─────────────────────────────────────────────────

// Pone en pantalla el programa de la franja (nombre y ambiente).
async function showBlock(b, list) {
  ui.playlistLink.href = `https://open.spotify.com/playlist/${encodeURIComponent(b.playlist)}`;
  ui.playlistLink.hidden = !b.playlist;
  ui.playlist.textContent = b.genres ? `${b.name}, ${b.genres.charAt(0).toLowerCase()}${b.genres.slice(1)}` : b.name;
  applyMood(await detectMood(b, list, spotify.getArtistGenres));
  fitTitle(); // el ambiente puede cambiar la tipografía
}

async function loadBlock(b) {
  if (!b.playlist) throw new Error(`La franja de las ${b.from} no tiene playlist. Revisa js/config.js.`);
  const list = await spotify.getPlaylist(b.playlist);
  if (!list.tracks.length) throw new Error(`El programa «${b.name}» no tiene canciones reproducibles.`);
  return list;
}

// Sintoniza lo que suena ahora mismo según el reloj (al entrar o al volver al directo).
async function goLive() {
  block = currentBlock();
  playlist = await loadBlock(block);
  await showBlock(block, playlist);

  const { queue, offset } = tuneIn(playlist, block);
  await spotify.playAt(deviceId, queue.map((t) => t.uri), offset);
  live = true;
}

// Cambio de franja sin cortar: la canción que suena acaba y la siguiente ya es del programa nuevo.
const LEAD_MS = 600; // margen para que la petición a Spotify llegue justo cuando acaba la canción
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const remainingMs = () => (progress.paused ? 0 : Math.max(0, progress.dur - (progress.pos + performance.now() - progress.at)));
let changing = false;

async function changeBlockGently() {
  changing = true;
  try {
    let next = currentBlock();
    let nextPlaylist = await loadBlock(next); // se descarga ya, mientras acaba la canción

    while (live && remainingMs() > LEAD_MS) await sleep(Math.min(1000, remainingMs() - LEAD_MS));
    if (!live || currentBlock().key === block?.key) return; // pausa o vuelta al directo mientras tanto

    if (currentBlock().key !== next.key) { next = currentBlock(); nextPlaylist = await loadBlock(next); }
    const { queue, offset } = tuneIn(nextPlaylist, next);
    // Si por reloj tocaría a mitad de una canción, se empieza por la siguiente entera.
    const list = offset > 5000 ? queue.slice(1) : queue;
    block = next;
    playlist = nextPlaylist;
    await spotify.playAt(deviceId, list.map((t) => t.uri), 0);
    await showBlock(block, playlist);
  } catch (e) {
    console.warn("Cambio de franja fallido:", e);
  } finally {
    changing = false;
  }
}

function checkBlock() {
  if (live && !changing && currentBlock().key !== block?.key) changeBlockGently();
}

ui.toggle.addEventListener("click", async () => {
  if (!player) return;
  if (progress.paused) {
    ui.toggle.disabled = true;
    try { await goLive(); } catch (e) { console.warn(e); }
    ui.toggle.disabled = false;
  } else {
    live = false;
    player.pause();
  }
});

ui.volume.addEventListener("input", () => {
  const v = Number(ui.volume.value);
  player?.setVolume(v);
  ui.volumeHint.hidden = v > 0;
});

// ── Estado del reproductor ──────────────────────────────────

function onPlayerState(state) {
  if (!state) return;
  Object.assign(progress, { pos: state.position, dur: state.duration || 1, at: performance.now(), paused: state.paused });

  ui.onair.dataset.state = state.paused ? "off" : "on";
  ui.onairLabel.textContent = state.paused ? "En pausa" : "En directo";
  ui.toggle.textContent = state.paused ? "Volver al directo" : "Pausar";

  const t = state.track_window?.current_track;
  if (!t) return;
  const key = t.uri;
  if (key === lastTrackKey) return;
  lastTrackKey = key;
  renderTrack(t);
}

// Encoge el título hasta que la palabra más larga quepa entera (sin partirla a mitad).
function fitTitle() {
  const el = ui.title;
  el.classList.remove("is-tight");
  el.style.fontSize = "";
  const max = parseFloat(getComputedStyle(el).fontSize);
  const min = Math.max(22, max * 0.4);
  let size = max;
  for (let i = 0; i < 30 && el.scrollWidth > el.clientWidth + 1 && size > min; i++) {
    size = Math.max(min, size * 0.94);
    el.style.fontSize = `${size}px`;
  }
  if (el.scrollWidth > el.clientWidth + 1) el.classList.add("is-tight");
}
let lastTitleWidth = 0;
new ResizeObserver(([entry]) => {
  const w = Math.round(entry.contentRect.width);
  if (w !== lastTitleWidth) { lastTitleWidth = w; fitTitle(); }
}).observe(ui.title.parentElement);
document.fonts?.addEventListener?.("loadingdone", fitTitle);

function renderTrack(sdkTrack) {
  // Preferimos nuestros datos (tienen ids de artista y año); si no, los del SDK.
  const known = playlist?.tracks.find((t) => t.uri === sdkTrack.uri || t.id === sdkTrack.id || t.id === sdkTrack.linked_from?.id);
  const track = known || {
    id: sdkTrack.id,
    uri: sdkTrack.uri,
    name: sdkTrack.name,
    artists: sdkTrack.artists.map((a) => ({ id: a.uri?.split(":").pop(), name: a.name })),
    album: sdkTrack.album?.name || "",
    year: "",
    image: [...(sdkTrack.album?.images || [])].sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url || "",
  };

  ui.title.textContent = track.name;
  fitTitle();
  ui.artist.textContent = track.artists.map((a) => a.name).join(", ");
  ui.album.textContent = [track.album, track.year].filter(Boolean).join(", ");
  ui.cover.src = track.image || "";
  ui.cover.alt = track.album ? `Portada de ${track.album}` : "";
  applyCover(track.image);

  const primary = track.artists[0]?.name || "el artista";
  ui.artistTitle.textContent = `Sobre ${primary}`;
  setCtx(ui.artistText, ui.artistSrc, null, "Buscando algo sobre quien la toca…");

  const requested = track.uri;
  getContext(track).then(({ artist }) => {
    if (lastTrackKey !== requested && lastTrackKey !== sdkTrack.uri) return;
    setCtx(ui.artistText, ui.artistSrc, artist, `Todavía no hay nada escrito sobre ${primary}.`);
  });
}

function setCtx(textEl, srcEl, data, fallback) {
  textEl.textContent = data?.text || fallback;
  textEl.classList.toggle("is-empty", !data?.text);
  if (data?.url) {
    srcEl.hidden = false;
    srcEl.href = data.url;
    srcEl.textContent = data.source;
  } else if (data?.source) {
    srcEl.hidden = false;
    srcEl.removeAttribute("href");
    srcEl.textContent = data.source;
  } else {
    srcEl.hidden = true;
  }
}

// Barra de progreso interpolada entre eventos del SDK.
(function loop() {
  const pos = progress.paused ? progress.pos : progress.pos + (performance.now() - progress.at);
  ui.fill.style.transform = `scaleX(${Math.min(1, pos / progress.dur)})`;
  requestAnimationFrame(loop);
})();
