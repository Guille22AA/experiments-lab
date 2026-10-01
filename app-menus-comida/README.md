# Pantry & Menus

A personal web app that plans what I cook and what I buy, with an AI assistant that learns my tastes.

**The problem:** every week I have to decide what to eat, check what's left at home and write a shopping list. This app does it shopping trip to shopping trip: after each shop it proposes a menu built around what I already have, and it turns whatever is missing into a shopping list sorted by supermarket aisle.

> 🚧 **Work in progress.** It is built in 8 phases ([roadmap](#roadmap)). Phases 1–5 are done.

<!-- Screenshots will be added in phase 8 -->

## Features

- **AI onboarding interview.** A natural chat to learn allergies, tastes, how much I feel like cooking, kitchen equipment… then a summary I can review and edit.
- **Always-on assistant.** A floating chat on every screen that knows which screen it was opened from.
- **Editable profile** with a light/dark theme (follows the system by default).
- **Pantry** grouped by supermarket aisle, with approximate levels (plenty / some / little / out). Tap to lower a level, swipe to remove, with undo.
- **Receipt reading.** Upload a photo or PDF of the receipt: the AI extracts the products, the app matches them with products it already knows, and I review everything before saving.
- **Products learned with use.** New products get an aisle and allergen tags from a built-in ingredient dictionary (no AI needed); next time they are recognized, even by the receipt text.
- **Menus per shopping cycle.** The AI plans the days until the next shop around what is at home, my tastes and the time I have each day (quick on weekdays, longer at weekends), with batch cooking and leftovers. I review the proposal, then change, move, skip or mark dishes as cooked; cooking proposes lowering the pantry.
- **Dietary restrictions as hard filters.** Every ingredient of every dish is checked in code. Dishes that break a restriction are sent back to the AI to be replaced, and if one still slips through it gets a big red warning. Ingredients with no allergen data are flagged.
- **Shopping list by aisle**, in the order I walk the supermarket. Items come from the menu (what is missing), from the pantry ("out → add to list") or by hand, without duplicates. Tap to tick (ticked items drop to the bottom of their aisle); bought products leave the list when the purchase is registered. Export as text (share or copy), `.txt` download, or a printable / PDF version.
- **Personal recipe book ("cooking memory").** It grows with the AI dishes I cook, the recipes I write, the ones I tell informally ("with the instant noodles my mum buys I make a ramen with textured soy and teriyaki" → a structured recipe, asking only what is essential) and the ones imported from a link (schema.org JSON-LD first, AI only as a fallback). Recipes can be variations of another one or linked to a product, so the planner proposes the recipe instead of the product as it is. Videos are not imported: they are told as text.
- **Quick feedback instead of stars** after cooking ("loved it", "too slow", "don't propose it again", "make it faster / less spicy…"). The planner uses it, and disliked recipes are filtered out in code.
- **Shopping cycles.** A normal shop starts a new cycle; small top-ups don't. The app learns how many days I usually go between shops.
- **Works without AI:** if the provider is down or the free quota runs out, everything except the assistant keeps working.

Coming next: assistant actions with confirmation and undo, and nutrition info from Open Food Facts.

### Design principles

- **Dietary restrictions are hard filters checked in code**, not just instructions to the AI.
- **The AI never changes data by itself.** It proposes actions and I confirm them.
- **The app owns the memory.** Profile, recipes and history live in the database. The AI only gets a short, task-specific context, so switching providers loses nothing.
- **Zero budget.** Free AI tier, SQLite, runs locally.

## Stack

| Part | Tech |
|---|---|
| Frontend | React, Vite, React Router, mobile-first CSS with custom properties |
| Backend | Node.js, Express 5, zod validation |
| Database | SQLite (better-sqlite3) behind a small repository layer |
| AI | Google Gemini (free tier), behind a provider-agnostic `aiService` |

## Getting started

Requirements: Node.js 22+.

```bash
npm install
cp backend/.env.example backend/.env   # then add your GEMINI_API_KEY
npm run dev
```

- PC: open http://localhost:5173
- **Phone (same Wi-Fi):** Vite prints a `Network` address such as `http://192.168.1.x:5173`. Open it on the phone, and use "Add to home screen" to get an app icon.

The phone only talks to Vite, which forwards `/api` to the backend, so the backend stays private to the PC.

Production-like run: `npm run build && npm start` (Express serves the built frontend).

### Environment variables

All of them are documented in [`backend/.env.example`](backend/.env.example). The main ones:

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `gemini` | Which AI provider to use |
| `AI_MODEL` | `gemini-flash-latest` | Model name for that provider |
| `AI_FALLBACK_MODEL` | `gemini-flash-lite-latest` | Model for the automatic retry when the main one is overloaded |
| `GEMINI_API_KEY` | — | Free key from [Google AI Studio](https://aistudio.google.com/apikey) |
| `PORT` / `HOST` | `3001` / `127.0.0.1` | Where the API listens |
| `DB_PATH` | `./data/app.db` | SQLite file |

API keys live only in `backend/.env`, which is git-ignored. The frontend never sees them.

### Switching AI provider

The rest of the app only calls `backend/src/ai/aiService.js`. To add a provider (Claude, Groq, Ollama…):

1. Create `backend/src/ai/providers/<name>.js` exposing `generate({ system, messages, json, files })`, following [`gemini.js`](backend/src/ai/providers/gemini.js).
2. Register it in the `PROVIDERS` map in `aiService.js`.
3. Set `AI_PROVIDER`, `AI_MODEL` and the provider's key in `.env`.

## Project structure

```
backend/src/
  ai/          aiService, providers, contextBuilder, prompts, zod schemas
  domain/      business rules without AI (restrictions, profile…)
  db/          SQLite connection, schema, repositories (the only place with SQL)
  routes/      thin REST endpoints
frontend/src/
  pages/  components/  context/  api/  styles/
docs/          full spec and data model
```

## Roadmap

1. ✅ Base project, AI service, chat, onboarding and profile
2. ✅ Pantry and purchases (receipt reading), shopping cycles
3. ✅ Menu generation and management, restrictions as hard filters
4. ✅ Shopping list by aisle, export (.txt, share, print)
5. ✅ Recipe book: variations, recipes linked to products, import from text and links, feedback
6. Assistant actions with confirmation cards, history and undo
7. Nutrition info (Open Food Facts) and approximate prices
8. Design polish, accessibility and screenshots

## Future work

- **Authentication and multi-user.** There is no login: it is meant for one person on a home network. It must be added before any deployment to the internet.
- Internet deployment (the config is already environment-based).
- Notifications and reminders.
- Exact quantities and expiry dates in the pantry.
- Offline mode for the shopping list.
- Recipe import from videos (today they are described to the assistant as text).
- No supermarket scraping, by design: products are entered by hand, from receipts, or learned through use.
