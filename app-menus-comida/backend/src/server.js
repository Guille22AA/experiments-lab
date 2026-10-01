// Express server: JSON API under /api and, in production, the built frontend.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { config } from './config.js';
import './db/connection.js'; // opens the database and creates the tables
import { AiError } from './ai/aiErrors.js';
import { isAiConfigured } from './ai/aiService.js';
import { HttpError } from './lib/errors.js';
import { chatRoutes } from './routes/chatRoutes.js';
import { menuRoutes } from './routes/menuRoutes.js';
import { onboardingRoutes } from './routes/onboardingRoutes.js';
import { pantryRoutes } from './routes/pantryRoutes.js';
import { productRoutes } from './routes/productRoutes.js';
import { profileRoutes } from './routes/profileRoutes.js';
import { purchaseRoutes } from './routes/purchaseRoutes.js';
import { recipeRoutes } from './routes/recipeRoutes.js';

const app = express();
app.use(express.json({ limit: '15mb' })); // receipts (images/PDF) arrive as base64

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ai: { configured: isAiConfigured(), provider: config.ai.provider, model: config.ai.model } });
});
app.use('/api/profile', profileRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/pantry', pantryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/recipes', recipeRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: { message: 'Esa ruta de la API no existe.' } });
});

// Production: serve the built React app (in development Vite does this).
if (fs.existsSync(config.frontendDist)) {
  app.use(express.static(config.frontendDist));
  app.get('/{*path}', (req, res) => res.sendFile(path.join(config.frontendDist, 'index.html')));
} else {
  // Development: the app is served by Vite, not here. Point lost visitors to it.
  app.get('/', (req, res) => {
    res
      .type('html')
      .send(
        '<p style="font:18px system-ui;padding:24px">Esto es la API de la app, no la app.<br>' +
          'Ábrela en <a href="http://localhost:5173">http://localhost:5173</a> ' +
          '(desde el móvil, con la IP del PC y el puerto 5173).</p>',
      );
  });
}

// Central error handler: every error ends up here as { error: { code?, message } }.
// eslint-disable-next-line no-unused-vars
app.use((error, req, res, next) => {
  if (error instanceof AiError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: { message: error.message } });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'El archivo es demasiado grande (máximo unos 10 MB).' } });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'El cuerpo de la petición no es JSON válido.' } });
  }
  console.error(error);
  res.status(500).json({ error: { message: 'Algo ha fallado en el servidor.' } });
});

app.listen(config.port, config.host, () => {
  console.log(`API listening on http://${config.host}:${config.port}`);
  if (!isAiConfigured()) console.warn('[ai] No API key: the assistant is disabled until GEMINI_API_KEY is set in backend/.env');
});
