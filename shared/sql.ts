/**
 * Les requetes que le Worker execute vraiment. Isolees ici pour que les tests les
 * exercent telles quelles : une requete recopiee dans un test finit toujours par
 * diverger de celle qui tourne en production.
 */

/** Colonnes de la vue `card_item`, qui unifie caracteres et phrases. */
export const COLS = `id, item_id, kind, due, stability, difficulty, elapsed_days, scheduled_days,
         learning_steps, reps, lapses, state, last_review,
         text, reading, script, grp, meanings, meaning_lang, on_readings, kun_readings,
         strokes, translation`

/** Attend deux parametres : utilisateur, langue. */
export const FROM = `
    FROM card_item
   WHERE user_id = ? AND lang = ? AND suspended = 0`

export const SELECT = `SELECT ${COLS}${FROM}`

/**
 * Les nouvelles cartes sont servies en alternance entre familles. Sans ca, un tri global
 * unique fait passer les 208 kana (ord 0-103) avant le premier kanji (ord 1000+), et
 * ajouter des kanji ne donne rien a reviser pendant des jours.
 *
 * `${FILTER}` est remplace par la selection de famille avant execution.
 */
export const NEW_CARDS = `
  SELECT * FROM (
    SELECT ${COLS},
           ROW_NUMBER() OVER (PARTITION BY script ORDER BY ord, kind) AS rn
      ${FROM}\${FILTER} AND state = 0
  )
   WHERE rn <= ?
   ORDER BY rn, script
   LIMIT ?`

/**
 * Le contenu choisi dont la carte n'existe pas encore. Attend deux parametres :
 * utilisateur, langue.
 */
export const PENDING = `
    FROM content ct
    JOIN deck_selection d
      ON d.user_id = ? AND d.lang = ct.lang AND d.script = ct.script AND d.grp = ct.grp
   WHERE ct.lang = ?
     AND NOT EXISTS (
       SELECT 1 FROM card k
        WHERE k.user_id = d.user_id AND k.item_type = ct.item_type AND k.item_id = ct.item_id
     )`

/**
 * Les elements a materialiser ensuite, en alternance entre familles.
 * `${FILTER}` porte sur `ct.script`.
 */
export const NEXT_ITEMS = `
    SELECT * FROM (
      SELECT ct.item_type, ct.item_id, ct.script, ct.text,
             ROW_NUMBER() OVER (PARTITION BY ct.script ORDER BY ct.ord) AS rn
        ${PENDING}\${FILTER}
    )
     WHERE rn <= ? ORDER BY rn, script LIMIT ?`

const KANJI_IN = /[一-龯]/

/**
 * Les cartes a creer pour un element. Deux dans la plupart des cas, une seule pour un
 * mot ecrit uniquement en kana : lui demander sa lecture reviendrait a recopier ce qui
 * est deja affiche.
 */
export function kindsFor(script: string, text: string): string[] {
  if (script === 'word') return KANJI_IN.test(text) ? ['meaning', 'reading'] : ['meaning']
  if (script === 'kanji') return ['meaning', 'reading']
  if (script === 'sentence') return ['meaning', 'cloze']
  return ['reading', 'recall']
}

/**
 * Les kanji qu'on maitrise : au moins une carte arrivee en revision (etat 2 de FSRS),
 * ni mise de cote ni encore en apprentissage. Attend un parametre : l'utilisateur.
 */
export const KNOWN_KANJI = `
        SELECT item_id FROM card
         WHERE user_id = ? AND item_type = 'character' AND state = 2 AND suspended = 0`

/**
 * Les phrases dont on connait tous les kanji. Mesure de capacite plutot que de volume :
 * elle monte quand on apprend et redescend quand on oublie, ce qui la rend credible.
 * Attend : langue, utilisateur.
 */
export const READABLE = `
  SELECT COUNT(*) AS n FROM sentence s
   WHERE s.lang = ?
     AND NOT EXISTS (
       SELECT 1
         FROM sentence_word sw
         JOIN word_character wc ON wc.word_id = sw.word_id
        WHERE sw.sentence_id = s.id
          AND wc.character_id NOT IN (${KNOWN_KANJI})
     )`

/**
 * Les phrases auxquelles il ne manque qu'un seul kanji : ce qui est a portee de main.
 * Attend : utilisateur, langue.
 */
export const ALMOST = `
  SELECT COUNT(*) AS n FROM (
    SELECT sw.sentence_id
      FROM sentence_word sw
      JOIN word_character wc ON wc.word_id = sw.word_id
      JOIN sentence s ON s.id = sw.sentence_id
     WHERE s.lang = ?
       AND wc.character_id NOT IN (${KNOWN_KANJI})
     GROUP BY sw.sentence_id
    HAVING COUNT(DISTINCT wc.character_id) = 1
  )`

/** Les sens des mots, pour fabriquer les mauvaises reponses. Attend : langue. */
export const WORD_GLOSSES = `
  SELECT gloss FROM word
   WHERE lang = ? AND gloss <> '' ORDER BY RANDOM() LIMIT 80`

/** Les mots d'une phrase, avec leur sens, pour eclairer le mot masque. */
export const SENTENCE_WORDS = `
  SELECT sw.sentence_id, sw.pos, sw.surface, w.gloss
    FROM sentence_word sw
    JOIN word w ON w.id = sw.word_id
   WHERE sw.sentence_id IN (:ids)
   ORDER BY sw.sentence_id, sw.pos`
