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

  ai: {
    provider: (process.env.AI_PROVIDER || 'gemini').toLowerCase(),
    model: process.env.AI_MODEL || 'gemini-flash-latest',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
  },
};
