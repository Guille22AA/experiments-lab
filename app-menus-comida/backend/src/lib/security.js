// HTTP security helpers: session cookie, login attempt limit, request origin
// check and basic security headers. Small and dependency-free on purpose.
import { config } from '../config.js';
import { isPasswordSet, isValidSession } from '../domain/auth.js';
import { HttpError } from './errors.js';

export const SESSION_COOKIE = 'menus_session';

/** Reads one cookie from the request (no cookie-parser needed for a single cookie). */
export function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

/** httpOnly: JavaScript cannot read it. SameSite=Lax: other websites cannot use it. */
export function setSessionCookie(res, { token, expiresAt }) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.auth.secureCookies,
    expires: new Date(expiresAt),
    path: '/',
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: config.auth.secureCookies, path: '/' });
}

/** Every /api route behind this needs a valid session (unless auth is turned off). */
export function requireAuth(req, res, next) {
  if (!config.auth.required) return next();
  if (isValidSession(readCookie(req, SESSION_COOKIE))) return next();
  res.status(401).json({ error: { code: 'unauthorized', message: isPasswordSet() ? 'Inicia sesión para continuar.' : 'Crea tu contraseña para empezar.' } });
}

// ---------- Login attempt limit ----------

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;
const failures = new Map(); // ip → { count, since }

/** Throws 429 after too many wrong passwords from the same address. */
export function checkLoginAllowed(ip) {
  const entry = failures.get(ip);
  if (entry && Date.now() - entry.since > WINDOW_MS) failures.delete(ip);
  if ((failures.get(ip)?.count ?? 0) >= MAX_FAILURES) {
    const minutes = Math.ceil((WINDOW_MS - (Date.now() - failures.get(ip).since)) / 60_000);
    throw new HttpError(429, `Demasiados intentos. Espera ${minutes} minutos y vuelve a probar.`);
  }
}

export function recordLoginFailure(ip) {
  const entry = failures.get(ip) ?? { count: 0, since: Date.now() };
  entry.count += 1;
  failures.set(ip, entry);
}

export const clearLoginFailures = (ip) => failures.delete(ip);

// ---------- Headers and origin ----------

/** Basic security headers for every response. */
export function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY', // the app cannot be embedded in another site
    'Referrer-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), microphone=()',
  });
  next();
}

/**
 * Changes (POST, PUT, PATCH, DELETE) must come from the app itself, not from
 * another website the user is visiting (CSRF protection, on top of SameSite).
 */
export function sameOriginOnly(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser clients (curl, scripts) do not send it
  const host = req.headers['x-forwarded-host'] ?? req.headers.host;
  try {
    if (new URL(origin).host === host) return next();
  } catch {
    // malformed Origin header: rejected below
  }
  res.status(403).json({ error: { message: 'Petición rechazada: no viene de la app.' } });
}
