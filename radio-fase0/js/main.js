import { CONFIG } from "./config.js";
import * as spotify from "./spotify.js";
import { currentBlock, tuneIn, clockText } from "./radio.js";
import { detectMood, applyMood, applyCover } from "./theme.js";
import { getContext } from "./context.js";
import { startNews, startCarteles, startTablon } from "./panels.js";
import { startParrilla } from "./parrilla.js";

const $ = (s) => document.querySelector(s);
const ui = {
  station: $(".station-name"),
  onair: $(".onair"),
  onairLabel: $(".onair-label"),
  slot: $(".slot-label"),
  clock: $(".clock"),
  cover: $(".cover img"),
  playlist: $(".playlist-name"),
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

async function goLive() {
  block = currentBlock();
  if (!block.playlist) throw new Error(`La franja de las ${block.from} no tiene playlist. Revisa js/config.js.`);
  playlist = await spotify.getPlaylist(block.playlist);
  if (!playlist.tracks.length) throw new Error(`El programa «${block.name}» no tiene canciones reproducibles.`);

  ui.playlist.textContent = block.genres ? `${block.name}, ${block.genres.charAt(0).toLowerCase()}${block.genres.slice(1)}` : block.name;
  applyMood(await detectMood(block, playlist, spotify.getArtistGenres));

  const { queue, offset } = tuneIn(playlist, block);
  await spotify.playAt(deviceId, queue.map((t) => t.uri), offset);
  live = true;
}

async function checkBlock() {
  if (!live) return;
  if (currentBlock().key !== block?.key) {
    try { await goLive(); } catch (e) { console.warn("Cambio de franja fallido:", e); }
  }
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
    setCtx(ui.artistText, ui.artistSrc, artist, `Todavía no hay nada escrito sobre ${primary}. Puedes añadirlo tú en data/notas.json.`);
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
