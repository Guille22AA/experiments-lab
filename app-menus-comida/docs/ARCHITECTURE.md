# Arquitectura y modelo de datos

## Estructura de carpetas

```
app-menus-comida/
├── CLAUDE.md                 # Instrucciones para Claude Code
├── README.md                 # En inglés (fase 8)
├── package.json              # Scripts raíz: arrancar back + front a la vez
├── docs/
│   ├── SPEC.md               # Especificación completa
│   └── ARCHITECTURE.md       # Este archivo
├── backend/
│   ├── package.json
│   ├── .env.example          # Todas las variables documentadas (.env NO se sube)
│   ├── data/                 # app.db de SQLite (ignorado por git)
│   └── src/
│       ├── server.js         # Arranque de Express
│       ├── config.js         # Lee y valida variables de entorno (único sitio con process.env)
│       ├── db/
│       │   ├── connection.js # Abre SQLite y aplica schema.sql
│       │   ├── schema.sql
│       │   ├── seed.js       # Mercadona + secciones, perfil vacío
│       │   └── repositories/ # Capa de datos: único sitio con SQL (profileRepo, pantryRepo...)
│       ├── ai/
│       │   ├── aiService.js      # Interfaz común: chat(), generateJson(schema), readDocument()
│       │   ├── providers/        # gemini.js (después claude.js, groq.js, ollama.js)
│       │   ├── contextBuilder.js # Contexto resumido por tarea
│       │   ├── prompts/          # Prompt de sistema de cada papel
│       │   └── schemas/          # Esquemas zod de lo que devuelve la IA
│       ├── domain/           # Lógica sin IA: restrictions, cycles, pantry, shoppingList, actions
│       ├── routes/           # Endpoints REST finos: validan entrada y llaman a domain/
│       └── lib/              # Utilidades (errores HTTP, normalizar texto...)
└── frontend/
    ├── package.json
    ├── vite.config.js        # proxy /api → backend, --host para la red local
    ├── public/               # Icono y manifest (añadir a pantalla de inicio)
    └── src/
        ├── main.jsx, App.jsx
        ├── api/              # Cliente fetch (siempre rutas relativas /api)
        ├── pages/            # MenuPage, PantryPage, ShoppingListPage, RecipesPage, SettingsPage, OnboardingPage
        ├── components/       # layout/ (BottomNav, Header), assistant/ (FAB, ChatPanel, ActionCard), ui/
        ├── hooks/
        └── styles/           # tokens.css (variables claro/oscuro), global.css
```

Decisiones clave:
- **El frontend solo habla con `/api` relativo.** En desarrollo, Vite hace de proxy al backend; en producción, Express sirve el frontend compilado. Así no hay URLs escritas a mano ni CORS, y el móvil solo necesita una dirección.
- **Capas del backend:** `routes` → `domain` → `repositories`. La IA solo se toca desde `ai/aiService.js`. Si mañana se cambia SQLite por Postgres, solo cambian `db/`.
- **Un único `config.js`** lee el entorno; el resto del código importa de ahí.

## Modelo de datos (SQLite)

Convenciones: listas pequeñas (gustos, utensilios, etiquetas) en columnas JSON para no multiplicar tablas; fechas en ISO 8601 (texto); `id` entero autoincremental.

### Perfil
**profile** (una sola fila, `id = 1`)
| campo | tipo | nota |
|---|---|---|
| people_count | int | |
| meals_to_plan | JSON | `["lunch","dinner"]` |
| cooking_motivation | text | `low` / `medium` / `high` (pereza) |
| weekday_minutes, weekend_minutes | int | tiempo para cocinar |
| skill_level | text | `beginner` / `intermediate` / `advanced` |
| equipment | JSON | `["oven","airfryer","microwave"]` |
| likes, dislikes | JSON | ingredientes, platos y cocinas |
| batch_cooking, uses_leftovers | bool | |
| shopping_frequency_days | int | valor inicial, def. 7 |
| default_supermarket_id | FK | |
| extra_notes | JSON | hábitos sueltos detectados |
| theme | text | `system` / `light` / `dark` |
| onboarding_completed_at, updated_at | text | |

**restrictions**: id, kind (`allergy` / `intolerance` / `diet`), code (`gluten`, `lactose`, `nuts`, `vegan`, `vegetarian`...), label, note.

> Las reglas "restricción → etiquetas prohibidas" viven en código (`domain/restrictions.js`), no en la BD. Ej.: `vegan` prohíbe `animal_origin`; `gluten` prohíbe `contains_gluten`.

### Súper y productos
- **supermarkets**: id, name.
- **sections**: id, supermarket_id, name, position (orden de recorrido).
- **products**: id, name, normalized_name (único, para emparejar), aliases JSON (nombres vistos en tickets, p. ej. "LECHE ENTERA HACENDADO"), tags JSON (`contains_gluten`, `contains_dairy`, `animal_origin`...), tags_source (`dictionary` / `off` / `ai` / `manual`), tags_confirmed bool, off_barcode, approx_price, created_at.
- **product_sections**: product_id, supermarket_id, section_id (dónde está ese producto en cada súper).
- **off_cache** (fase 7): cache_key (código de barras o búsqueda), data JSON, fetched_at.

### Despensa, compras y ciclos
- **pantry_items**: id, product_id (único), level (`empty` / `low` / `medium` / `high`), added_at, updated_at.
- **shopping_cycles**: id, started_at, planned_days, ended_at, opening_purchase_id.
- **purchases**: id, cycle_id, kind (`main` / `extra`), purchased_at, source (`manual` / `ticket_image` / `ticket_pdf`), total_price.
- **purchase_items**: id, purchase_id, product_id, raw_text (línea del ticket), quantity_text, price.

### Recetas
- **recipes**: id, name, description, steps JSON, time_minutes, difficulty, servings, equipment JSON, tags JSON (`quick`, `batch`, `leftovers`, `cuisine:japanese`...), restriction_tags JSON (calculadas de los ingredientes + manuales), source (`ai` / `user` / `chat` / `link`), source_url, is_favorite, status (`suggested` = la propuso la IA y aún no la he usado / `saved`), parent_recipe_id (variaciones), linked_product_id (receta ligada a producto), created_at, updated_at.
- **recipe_ingredients**: id, recipe_id, product_id (nullable), name, quantity_text, optional bool. *(Tabla aparte, no JSON: hace falta para comprobar restricciones y descontar despensa ingrediente a ingrediente.)*
- **recipe_feedback**: id, recipe_id, cooked_log_id, verdict (`loved` / `too_slow` / `disliked` / `adjust`), adjustments JSON (`["faster","less_spicy","simpler"]`), note, is_first_time, created_at.

### Menús
- **menus**: id, cycle_id, start_date, days, status (`draft` / `active` / `archived`), created_at.
- **menu_slots**: id, menu_id, date, meal_type (`breakfast` / `lunch` / `dinner` / `snack`), recipe_id, title (por si no hay receta), status (`planned` / `cooked` / `skipped`), is_leftover, leftover_of_slot_id, batch_group, notes.
- **cooked_log**: id, recipe_id (nullable), title, menu_slot_id (nullable = fuera de menú), cooked_at.

### Lista de la compra
- **shopping_list_items**: id, product_id (nullable), text, quantity_text, section_id, checked, checked_at, source (`menu` / `manual` / `chat` / `pantry`), menu_id, created_at, updated_at.

Sin modo offline: para el súper se exporta la lista (.txt, compartir o imprimir).

### Asistente
- **chat_messages**: id, role (`user` / `assistant`), content, mode (`onboarding` / `chat`), screen_context JSON (desde qué pantalla y qué elemento), data JSON (extras estructurados, p. ej. el borrador de perfil al acabar la entrevista), created_at.
- **assistant_actions**: id, chat_message_id, type, payload JSON, summary (texto de la tarjeta), status (`proposed` / `accepted` / `rejected` / `undone` / `failed`), warnings JSON (avisos de restricciones), undo_data JSON, created_at, resolved_at.
