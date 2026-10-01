// The only file that reads environment variables.
// Everything else imports `config` from here, so all settings live in one place.
import path from 'node:path';

const backendRoot = path.resolve(import.meta.dirname, '..');

export const config = {
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || '127.0.0.1',
  dbPath: path.resolve(backendRoot, process.env.DB_PATH || './data/app.db'),
  // Built frontend, served by Express in production (`npm run build` at the project root).
  frontendDist: path.resolve(backendRoot, '../frontend/dist'),

  auth: {
    // Password protection. Only turn it off for the demo or tests.
    required: process.env.AUTH_REQUIRED !== 'false',
    sessionDays: Number(process.env.SESSION_DAYS) || 90,
    // true when the app is served over HTTPS (on the internet): cookies are then only sent encrypted.
    secureCookies: process.env.COOKIE_SECURE === 'true',
    // true behind a reverse proxy (Caddy, Nginx...), so the real client IP is used for the login limit.
    trustProxy: process.env.TRUST_PROXY === 'true',
  },

  ai: {
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    model: process.env.AI_MODEL || 'gemini-flash-latest',
    // Used for the retry when the main model is overloaded. Empty = retry with the same model.
    fallbackModel: process.env.AI_FALLBACK_MODEL ?? 'gemini-flash-lite-latest',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
  },
};
