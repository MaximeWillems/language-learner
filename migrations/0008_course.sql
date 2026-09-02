-- Le parcours guide. Le cours dit CE QU'ON apprend, le moteur FSRS dit QUAND on le revoit :
-- terminer une lecon ne fait que creer des cartes ordinaires.
-- Rien n'est verrouille : ces tables ne servent qu'a proposer un ordre et a mesurer.

CREATE TABLE milestone (
  id      INTEGER PRIMARY KEY,
  lang    TEXT NOT NULL REFERENCES language(code),
  pos     INTEGER NOT NULL,
  title   TEXT NOT NULL,
  summary TEXT NOT NULL,
  unlocks TEXT NOT NULL
);

CREATE TABLE lesson (
  id           INTEGER PRIMARY KEY,
  milestone_id INTEGER NOT NULL REFERENCES milestone(id),
  pos          INTEGER NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL
);

CREATE INDEX idx_lesson_milestone ON lesson (milestone_id, pos);

-- role : 'word' pour ce que la lecon enseigne, 'example' pour ce qu'elle illustre
CREATE TABLE lesson_item (
  lesson_id INTEGER NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
  role      TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id   INTEGER NOT NULL,
  pos       INTEGER NOT NULL,
  PRIMARY KEY (lesson_id, item_type, item_id)
);

CREATE INDEX idx_lesson_item_target ON lesson_item (item_type, item_id);

-- 'done' : parcourue. 'known' : marquee comme deja acquise sans etre lue.
CREATE TABLE lesson_progress (
  user_id    TEXT NOT NULL,
  lesson_id  INTEGER NOT NULL REFERENCES lesson(id) ON DELETE CASCADE,
  state      TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, lesson_id)
);

-- Les mots deviennent une famille de cartes a part entiere. Leur traduction vient de la
-- lecon qui les enseigne : inutile d'importer un dictionnaire entier pour les quelques
-- centaines de mots effectivement presentes.
DROP VIEW card_item;

CREATE VIEW card_item AS
SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       ch.glyph AS text, ch.reading, ch.kind AS script, ch.grp, ch.ord,
       ch.meanings, ch.meaning_lang, ch.on_readings, ch.kun_readings, ch.strokes,
       NULL AS translation
  FROM card c JOIN character ch ON ch.id = c.item_id
 WHERE c.item_type = 'character'

UNION ALL

SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       s.text, s.reading, 'sentence', 'level' || s.level, 100000 + s.id,
       NULL, NULL, NULL, NULL, NULL,
       s.translation
  FROM card c JOIN sentence s ON s.id = c.item_id
 WHERE c.item_type = 'sentence'

UNION ALL

SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       w.lemma, w.reading, 'word', 'lesson', 200000 + w.id,
       json_array(w.gloss), 'fr', NULL, NULL, NULL,
       w.gloss
  FROM card c JOIN word w ON w.id = c.item_id
 WHERE c.item_type = 'word';
