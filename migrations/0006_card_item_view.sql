-- Vue unifiee des cartes : un caractere et une phrase n'ont pas les memes colonnes,
-- mais la file de revision doit les traiter ensemble. Sans ca, chaque requete du
-- moteur devrait exister en deux versions.
CREATE VIEW card_item AS
SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       ch.glyph        AS text,
       ch.reading      AS reading,
       ch.kind         AS script,
       ch.grp          AS grp,
       ch.ord          AS ord,
       ch.meanings     AS meanings,
       ch.meaning_lang AS meaning_lang,
       ch.on_readings  AS on_readings,
       ch.kun_readings AS kun_readings,
       ch.strokes      AS strokes,
       NULL            AS translation
  FROM card c
  JOIN character ch ON ch.id = c.item_id
 WHERE c.item_type = 'character'

UNION ALL

SELECT c.id, c.user_id, c.lang, c.item_type, c.item_id, c.kind,
       c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
       c.learning_steps, c.reps, c.lapses, c.state, c.last_review, c.suspended,
       s.text,
       s.reading,
       'sentence',
       'level' || s.level,
       100000 + s.id,
       NULL, NULL, NULL, NULL, NULL,
       s.translation
  FROM card c
  JOIN sentence s ON s.id = c.item_id
 WHERE c.item_type = 'sentence';

CREATE INDEX idx_sentence_level ON sentence (lang, level, id);
CREATE INDEX idx_sentence_word_word ON sentence_word (word_id);
