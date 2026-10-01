-- Full data model (see docs/ARCHITECTURE.md).
-- Every statement is idempotent, so this file runs safely on every start.
-- Lists are stored as JSON text; dates as ISO 8601 text.

-- ---------- Profile ----------
CREATE TABLE IF NOT EXISTS profile (
  id                      INTEGER PRIMARY KEY CHECK (id = 1), -- single user
  people_count            INTEGER NOT NULL DEFAULT 1,
  meals_to_plan           TEXT    NOT NULL DEFAULT '["lunch","dinner"]',
  cooking_motivation      TEXT    NOT NULL DEFAULT 'medium',       -- low | medium | high
  weekday_minutes         INTEGER NOT NULL DEFAULT 30,
  weekend_minutes         INTEGER NOT NULL DEFAULT 60,
  skill_level             TEXT    NOT NULL DEFAULT 'intermediate', -- beginner | intermediate | advanced
  equipment               TEXT    NOT NULL DEFAULT '[]',
  likes                   TEXT    NOT NULL DEFAULT '[]',
  dislikes                TEXT    NOT NULL DEFAULT '[]',
  batch_cooking           INTEGER NOT NULL DEFAULT 0,
  uses_leftovers          INTEGER NOT NULL DEFAULT 1,
  shopping_frequency_days INTEGER NOT NULL DEFAULT 7,
  default_supermarket_id  INTEGER REFERENCES supermarkets(id),
  extra_notes             TEXT    NOT NULL DEFAULT '[]',
  theme                   TEXT    NOT NULL DEFAULT 'system',       -- system | light | dark
  onboarding_completed_at TEXT,
  updated_at              TEXT
);

CREATE TABLE IF NOT EXISTS restrictions (
  id    INTEGER PRIMARY KEY,
  kind  TEXT NOT NULL, -- allergy | intolerance | diet | other
  code  TEXT NOT NULL, -- see domain/restrictions.js
  label TEXT NOT NULL,
  note  TEXT
);

-- ---------- Supermarkets and products ----------
CREATE TABLE IF NOT EXISTS supermarkets (
  id   INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sections (
  id             INTEGER PRIMARY KEY,
  supermarket_id INTEGER NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
  name           TEXT    NOT NULL,
  position       INTEGER NOT NULL -- walking order inside the shop
);

CREATE TABLE IF NOT EXISTS products (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,       -- lowercase, no accents: used for matching
  aliases         TEXT NOT NULL DEFAULT '[]', -- names seen on tickets
  tags            TEXT NOT NULL DEFAULT '[]', -- contains_gluten, animal_origin...
  tags_source     TEXT,                       -- dictionary | off | ai | manual
  tags_confirmed  INTEGER NOT NULL DEFAULT 0,
  off_barcode     TEXT,
  approx_price    REAL,
  created_at      TEXT NOT NULL
);

-- Where a product lives in each supermarket.
CREATE TABLE IF NOT EXISTS product_sections (
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supermarket_id INTEGER NOT NULL REFERENCES supermarkets(id) ON DELETE CASCADE,
  section_id     INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, supermarket_id)
);

CREATE TABLE IF NOT EXISTS off_cache (
  cache_key  TEXT PRIMARY KEY, -- barcode or search text
  data       TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

-- ---------- Pantry, purchases and cycles ----------
CREATE TABLE IF NOT EXISTS pantry_items (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  level      TEXT    NOT NULL DEFAULT 'medium', -- empty | low | medium | high
  added_at   TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_cycles (
  id                  INTEGER PRIMARY KEY,
  started_at          TEXT    NOT NULL,
  planned_days        INTEGER NOT NULL,
  ended_at            TEXT,
  opening_purchase_id INTEGER
);

CREATE TABLE IF NOT EXISTS purchases (
  id           INTEGER PRIMARY KEY,
  cycle_id     INTEGER REFERENCES shopping_cycles(id),
  kind         TEXT NOT NULL, -- main | extra
  purchased_at TEXT NOT NULL,
  source       TEXT NOT NULL, -- manual | ticket_image | ticket_pdf
  total_price  REAL
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id            INTEGER PRIMARY KEY,
  purchase_id   INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id),
  raw_text      TEXT,
  quantity_text TEXT,
  price         REAL
);

-- ---------- Recipes ----------
CREATE TABLE IF NOT EXISTS recipes (
  id                INTEGER PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  steps             TEXT NOT NULL DEFAULT '[]',
  time_minutes      INTEGER,
  difficulty        TEXT, -- easy | medium | hard
  servings          INTEGER,
  equipment         TEXT NOT NULL DEFAULT '[]',
  tags              TEXT NOT NULL DEFAULT '[]',
  restriction_tags  TEXT NOT NULL DEFAULT '[]',
  source            TEXT NOT NULL, -- ai | user | chat | link
  source_url        TEXT,
  is_favorite       INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'saved', -- suggested | saved
  parent_recipe_id  INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  linked_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id            INTEGER PRIMARY KEY,
  recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  quantity_text TEXT,
  optional      INTEGER NOT NULL DEFAULT 0
);

-- ---------- Menus ----------
CREATE TABLE IF NOT EXISTS menus (
  id         INTEGER PRIMARY KEY,
  cycle_id   INTEGER REFERENCES shopping_cycles(id),
  start_date TEXT    NOT NULL,
  days       INTEGER NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'draft', -- draft | active | archived
  shopping_suggestions TEXT NOT NULL DEFAULT '[]', -- what the AI says to buy for this menu
  created_at TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_slots (
  id                  INTEGER PRIMARY KEY,
  menu_id             INTEGER NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  date                TEXT    NOT NULL,
  meal_type           TEXT    NOT NULL, -- breakfast | lunch | dinner | snack
  recipe_id           INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  title               TEXT,
  status              TEXT    NOT NULL DEFAULT 'planned', -- planned | cooked | skipped
  is_leftover         INTEGER NOT NULL DEFAULT 0,
  leftover_of_slot_id INTEGER REFERENCES menu_slots(id) ON DELETE SET NULL,
  batch_group         TEXT,
  notes               TEXT
);

CREATE TABLE IF NOT EXISTS cooked_log (
  id           INTEGER PRIMARY KEY,
  recipe_id    INTEGER REFERENCES recipes(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  menu_slot_id INTEGER REFERENCES menu_slots(id) ON DELETE SET NULL, -- NULL = outside the menu
  cooked_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_feedback (
  id            INTEGER PRIMARY KEY,
  recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  cooked_log_id INTEGER REFERENCES cooked_log(id) ON DELETE SET NULL,
  verdict       TEXT NOT NULL, -- loved | too_slow | disliked | adjust
  adjustments   TEXT NOT NULL DEFAULT '[]',
  note          TEXT,
  is_first_time INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL
);

-- ---------- Shopping list ----------
CREATE TABLE IF NOT EXISTS shopping_list_items (
  id            INTEGER PRIMARY KEY,
  product_id    INTEGER REFERENCES products(id) ON DELETE SET NULL,
  text          TEXT    NOT NULL,
  quantity_text TEXT,
  section_id    INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  checked       INTEGER NOT NULL DEFAULT 0,
  checked_at    TEXT,
  source        TEXT    NOT NULL, -- menu | manual | chat | pantry
  menu_id       INTEGER REFERENCES menus(id) ON DELETE SET NULL,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

-- ---------- Assistant ----------
CREATE TABLE IF NOT EXISTS chat_messages (
  id             INTEGER PRIMARY KEY,
  role           TEXT NOT NULL, -- user | assistant
  content        TEXT NOT NULL,
  mode           TEXT NOT NULL, -- onboarding | chat
  screen_context TEXT,          -- JSON: which screen/item the chat was opened from
  data           TEXT,          -- JSON: structured extras (e.g. onboarding profile draft)
  created_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_actions (
  id              INTEGER PRIMARY KEY,
  chat_message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,
  payload         TEXT NOT NULL,
  summary         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'proposed', -- proposed | accepted | rejected | undone | failed
  warnings        TEXT NOT NULL DEFAULT '[]',
  undo_data       TEXT,
  created_at      TEXT NOT NULL,
  resolved_at     TEXT
);

-- ---------- Access (single user: only a password) ----------
CREATE TABLE IF NOT EXISTS auth (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  password_hash TEXT NOT NULL, -- scrypt, never the password itself
  updated_at    TEXT NOT NULL
);

-- One row per logged-in device. Only a hash of the token is stored, so a
-- copy of the database does not let anyone log in.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash   TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent   TEXT
);
