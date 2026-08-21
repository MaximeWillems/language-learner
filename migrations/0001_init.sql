-- Socle : contenu partage / cartes / historique

CREATE TABLE language (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE character (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  lang    TEXT NOT NULL REFERENCES language(code),
  glyph   TEXT NOT NULL,
  kind    TEXT NOT NULL,
  reading TEXT NOT NULL,
  grp     TEXT NOT NULL,
  ord     INTEGER NOT NULL,
  UNIQUE (lang, kind, glyph)
);

CREATE INDEX idx_character_kind ON character (lang, kind, ord);

-- Prevu pour la phase 02 : phrase -> mots -> caracteres
CREATE TABLE word (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  lang    TEXT NOT NULL REFERENCES language(code),
  lemma   TEXT NOT NULL,
  reading TEXT NOT NULL,
  gloss   TEXT NOT NULL,
  UNIQUE (lang, lemma, reading)
);

CREATE TABLE sentence (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  lang         TEXT NOT NULL REFERENCES language(code),
  text         TEXT NOT NULL,
  reading      TEXT,
  translation  TEXT NOT NULL,
  trans_lang   TEXT NOT NULL,
  source       TEXT,
  level        INTEGER
);

CREATE TABLE sentence_word (
  sentence_id INTEGER NOT NULL REFERENCES sentence(id) ON DELETE CASCADE,
  word_id     INTEGER NOT NULL REFERENCES word(id),
  pos         INTEGER NOT NULL,
  surface     TEXT NOT NULL,
  PRIMARY KEY (sentence_id, pos)
);

CREATE TABLE word_character (
  word_id      INTEGER NOT NULL REFERENCES word(id) ON DELETE CASCADE,
  character_id INTEGER NOT NULL REFERENCES character(id),
  PRIMARY KEY (word_id, character_id)
);

-- Une carte = un contenu + une question precise
CREATE TABLE card (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        TEXT NOT NULL,
  lang           TEXT NOT NULL REFERENCES language(code),
  item_type      TEXT NOT NULL,
  item_id        INTEGER NOT NULL,
  kind           TEXT NOT NULL,
  due            TEXT NOT NULL,
  stability      REAL NOT NULL DEFAULT 0,
  difficulty     REAL NOT NULL DEFAULT 0,
  elapsed_days   INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  reps           INTEGER NOT NULL DEFAULT 0,
  lapses         INTEGER NOT NULL DEFAULT 0,
  state          INTEGER NOT NULL DEFAULT 0,
  last_review    TEXT,
  introduced_at  TEXT,
  suspended      INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  UNIQUE (user_id, item_type, item_id, kind)
);

CREATE INDEX idx_card_due ON card (user_id, lang, suspended, state, due);

CREATE TABLE review_log (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id           INTEGER NOT NULL REFERENCES card(id) ON DELETE CASCADE,
  rating            INTEGER NOT NULL,
  state             INTEGER NOT NULL,
  due               TEXT NOT NULL,
  stability         REAL NOT NULL,
  difficulty        REAL NOT NULL,
  elapsed_days      INTEGER NOT NULL,
  last_elapsed_days INTEGER NOT NULL,
  scheduled_days    INTEGER NOT NULL,
  reviewed_at       TEXT NOT NULL,
  answer            TEXT,
  correct           INTEGER
);

CREATE INDEX idx_log_card ON review_log (card_id, reviewed_at);

CREATE TABLE setting (
  user_id TEXT NOT NULL,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

INSERT INTO language (code, name) VALUES ('ja', 'Japonais');
