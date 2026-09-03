-- Le classement initial bornait le niveau scolaire des kanji mais pas leur nombre :
-- une phrase de « niveau 1 » pouvait en contenir huit. On reclasse sur une mesure qui
-- tient compte de tout ce qui rend une phrase difficile — combien de kanji distincts,
-- a quel niveau scolaire, combien de mots, et a quel point le plus rare l'est.
--
-- `rank` sert aussi d'ordre d'introduction : a l'interieur d'un niveau, les plus simples
-- arrivent en premier.

ALTER TABLE sentence ADD COLUMN rank INTEGER;

WITH metric AS (
  SELECT s.id AS id,
         (SELECT COUNT(*) FROM sentence_word sw WHERE sw.sentence_id = s.id) AS words,
         COALESCE((SELECT COUNT(DISTINCT c.id)
                     FROM sentence_word sw
                     JOIN word_character wc ON wc.word_id = sw.word_id
                     JOIN character c ON c.id = wc.character_id
                    WHERE sw.sentence_id = s.id), 0) AS kanji,
         COALESCE((SELECT MAX(c.grade)
                     FROM sentence_word sw
                     JOIN word_character wc ON wc.word_id = sw.word_id
                     JOIN character c ON c.id = wc.character_id
                    WHERE sw.sentence_id = s.id), 0) AS grade,
         COALESCE((SELECT MAX(w.ord)
                     FROM sentence_word sw
                     JOIN word w ON w.id = sw.word_id
                    WHERE sw.sentence_id = s.id), 2600) AS rare
    FROM sentence s
   WHERE s.lang = 'ja'
),
ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (ORDER BY kanji * 3 + grade * 2 + words + rare / 250.0, id) AS r
    FROM metric
)
UPDATE sentence
   SET rank  = (SELECT r FROM ranked WHERE ranked.id = sentence.id),
       level = (SELECT CASE WHEN r <= 900 THEN 1 WHEN r <= 2700 THEN 2
                            WHEN r <= 4800 THEN 3 ELSE 4 END
                  FROM ranked WHERE ranked.id = sentence.id)
 WHERE lang = 'ja';

-- La vue reprend le rang plutot que l'identifiant : l'ordre d'introduction suit
-- desormais la difficulte reelle.
DROP VIEW content;
CREATE VIEW content AS
SELECT 'character' AS item_type, id AS item_id, lang, kind AS script, grp, ord, glyph AS text
  FROM character
 WHERE grp <> 'rare'
UNION ALL
SELECT 'sentence', id, lang, 'sentence', 'level' || level, 100000 + rank, text
  FROM sentence
UNION ALL
SELECT 'word', id, lang, 'word', grp, 200000 + ord, lemma
  FROM word
 WHERE gloss <> '';

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
       s.text, s.reading, 'sentence', 'level' || s.level, 100000 + s.rank,
       NULL, NULL, NULL, NULL, NULL,
       s.translation
  FROM card c JOIN sentence s ON s.id = c.item_id
 WHERE c.item_type = 'sentence'
UNION ALL
SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       w.lemma, w.reading, 'word', w.grp, 200000 + w.ord,
       json_array(w.gloss), w.gloss_lang, NULL, NULL, NULL,
       NULL
  FROM card c JOIN word w ON w.id = c.item_id
 WHERE c.item_type = 'word';
