import { CONFIG } from "./config.js";

const API = "https://api.spotify.com/v1";
const ACCOUNTS = "https://accounts.spotify.com";
const TOKEN_KEY = "radio.token";
const VERIFIER_KEY = "radio.verifier";
const SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "playlist-read-private",
  "playlist-read-collaborative",
].join(" ");

// ── Auth (Authorization Code + PKCE, sin backend) ────────────

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function login() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = b64url(bytes);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  const params = new URLSearchParams({
    client_id: CONFIG.spotifyClientId,
    response_type: "code",
    redirect_uri: CONFIG.redirectUri,
    scope: SCOPES,
    code_challenge_method: "S256",
    code_challenge: challenge,
  });
  location.href = `${ACCOUNTS}/authorize?${params}`;
}

export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (params.get("error")) {
    history.replaceState(null, "", CONFIG.redirectUri);
    throw new Error("Spotify ha cancelado el inicio de sesión.");
  }
  const code = params.get("code");
  if (!code) return false;
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CONFIG.spotifyClientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: CONFIG.redirectUri,
      code_verifier: sessionStorage.getItem(VERIFIER_KEY) || "",
    }),
  });
  history.replaceState(null, "", CONFIG.redirectUri);
  if (!res.ok) throw new Error("No se pudo completar el inicio de sesión con Spotify.");
  saveToken(await res.json());
  return true;
}

function saveToken(t, previousRefresh) {
  const token = {
    access: t.access_token,
    refresh: t.refresh_token || previousRefresh,
    expires: Date.now() + (t.expires_in - 60) * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

function readToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY)); } catch { return null; }
}

export const hasSession = () => Boolean(readToken()?.refresh);
export const logout = () => localStorage.removeItem(TOKEN_KEY);

export async function getAccessToken() {
  let t = readToken();
  if (!t) throw new Error("No hay sesión de Spotify.");
  if (Date.now() < t.expires) return t.access;
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh, client_id: CONFIG.spotifyClientId }),
  });
  if (!res.ok) { logout(); throw new Error("La sesión de Spotify ha caducado. Vuelve a conectar."); }
  t = saveToken(await res.json(), t.refresh);
  return t.access;
}

// ── Web API ──────────────────────────────────────────────────

export async function api(path, options = {}) {
  const token = await getAccessToken();
  const res = await fetch(path.startsWith("http") ? path : API + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = new Error(`Spotify respondió ${res.status} en ${path}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const slimTrack = (t) => ({
  id: t.id,
  uri: t.uri,
  name: t.name,
  duration: t.duration_ms,
  artists: (t.artists || []).map((a) => ({ id: a.id, name: a.name })),
  album: t.album?.name || "",
  year: (t.album?.release_date || "").slice(0, 4),
  image: t.album?.images?.[0]?.url || "",
});

const stripHtml = (s) => new DOMParser().parseFromString(s, "text/html").body.textContent || "";

const playlistCache = new Map();

export async function getPlaylist(id) {
  if (playlistCache.has(id)) return playlistCache.get(id);
  const meta = await api(`/playlists/${id}`);
  const tracks = [];
  // Desde 2026 el endpoint es /items y cada entrada trae "item" (antes "track").
  let url = `/playlists/${id}/items?limit=50`;
  while (url) {
    const page = await api(url);
    for (const entry of page.items || []) {
      const t = entry.item || entry.track;
      if (t && t.type === "track" && !t.is_local && t.uri && t.duration_ms) tracks.push(slimTrack(t));
    }
    url = page.next;
  }
  const playlist = {
    id,
    name: meta.name,
    description: stripHtml(meta.description || ""),
    image: meta.images?.[0]?.url || "",
    tracks,
  };
  playlistCache.set(id, playlist);
  return playlist;
}

// Géneros de artistas (Spotify los devuelve a veces vacíos; si falla, se ignora).
export async function getArtistGenres(ids) {
  const lists = await Promise.all(
    ids.map((id) => api(`/artists/${id}`).then((a) => a.genres || []).catch(() => [])),
  );
  return lists.flat();
}

// ── Web Playback SDK ─────────────────────────────────────────

export function createPlayer(onState) {
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      const player = new window.Spotify.Player({
        name: CONFIG.stationName,
        getOAuthToken: (cb) => getAccessToken().then(cb).catch(() => {}),
        volume: CONFIG.volume,
      });
      player.addListener("ready", ({ device_id }) => resolve({ player, deviceId: device_id }));
      for (const ev of ["initialization_error", "authentication_error", "account_error"]) {
        player.addListener(ev, ({ message }) => reject(Object.assign(new Error(message), { kind: ev })));
      }
      player.addListener("player_state_changed", onState);
      player.connect();
    };
    const script = document.createElement("script");
    script.src = "https://sdk.scdn.co/spotify-player.js";
    script.onerror = () => reject(new Error("No se pudo cargar el reproductor de Spotify."));
    document.head.append(script);
  });
}

export function playAt(deviceId, uris, positionMs) {
  return api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: "PUT",
    body: JSON.stringify({ uris, position_ms: Math.max(0, Math.floor(positionMs)) }),
  });
}
