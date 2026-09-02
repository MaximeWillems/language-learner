-- Les mots deviennent une famille de contenu a part entiere, au meme titre que les
-- caracteres et les phrases : selectionnables, ordonnes par frequence reelle dans le
-- corpus, et servis par la meme file de revision.

DROP VIEW content;
CREATE VIEW content AS
SELECT 'character' AS item_type, id AS item_id, lang, kind AS script, grp, ord, glyph AS text
  FROM character
 WHERE grp <> 'rare'
UNION ALL
SELECT 'sentence', id, lang, 'sentence', 'level' || level, 100000 + id, text
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
  FROM card c
  JOIN character ch ON ch.id = c.item_id
 WHERE c.item_type = 'character'

UNION ALL

SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       s.text, s.reading, 'sentence', 'level' || s.level, 100000 + s.id,
       NULL, NULL, NULL, NULL, NULL,
       s.translation
  FROM card c
  JOIN sentence s ON s.id = c.item_id
 WHERE c.item_type = 'sentence'

UNION ALL

SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       w.lemma, w.reading, 'word', w.grp, 200000 + w.ord,
       json_array(w.gloss), w.gloss_lang, NULL, NULL, NULL,
       NULL
  FROM card c
  JOIN word w ON w.id = c.item_id
 WHERE c.item_type = 'word';
