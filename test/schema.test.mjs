import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { count, freshDb, migrations, one, rows } from './db.mjs'

test('les migrations s appliquent dans l ordre, sur une base vide', async () => {
  assert.ok(migrations.length >= 10)
  for (let n = 1; n <= migrations.length; n++) await freshDb(n)
})

test('les kana sont complets et sans doublon', async () => {
  const db = await freshDb()
  assert.equal(count(db, "character WHERE kind='hiragana'"), 104)
  assert.equal(count(db, "character WHERE kind='katakana'"), 104)
  // gojuon 46 + dakuten 23 + yoon 33 + les deux quasi disparus
  assert.equal(one(db, "SELECT COUNT(DISTINCT glyph) AS n FROM character WHERE kind='hiragana'").n, 104)
  assert.equal(count(db, "character WHERE grp='rare'"), 4, 'ぢ づ et leurs katakana')
})

test('les 2 136 kanji joyo sont la, avec leurs lectures', async () => {
  const db = await freshDb()
  assert.equal(count(db, "character WHERE kind='kanji'"), 2136)
  assert.equal(count(db, "character WHERE kind='kanji' AND meanings IS NULL"), 0)
  assert.equal(count(db, "character WHERE kind='kanji' AND on_readings IS NULL"), 0)
  assert.equal(
    count(db, "character WHERE kind='kanji' AND json_extract(meanings, '$[0]') IS NULL"), 0,
    'chaque kanji doit avoir un premier sens exploitable comme reponse'
  )
})

test('le francais couvre la grande majorite des kanji', async () => {
  const db = await freshDb()
  const fr = count(db, "character WHERE meaning_lang='fr'")
  assert.ok(fr > 1900, `${fr} kanji en francais, moins que prevu`)
  assert.equal(fr + count(db, "character WHERE meaning_lang='en'"), 2136)
})

test('chaque phrase a une traduction et un decoupage exploitable', async () => {
  const db = await freshDb()
  assert.equal(count(db, 'sentence'), 6000)
  assert.equal(count(db, "sentence WHERE translation = '' OR translation IS NULL"), 0)
  assert.equal(count(db, "sentence WHERE trans_lang <> 'fr'"), 0)

  const orphans = one(db, `
    SELECT COUNT(*) AS n FROM sentence s
     WHERE NOT EXISTS (SELECT 1 FROM sentence_word w WHERE w.sentence_id = s.id)`).n
  assert.equal(orphans, 0, 'une phrase sans mots ne peut pas donner de texte a trous')
})

test('aucune liaison ne pointe dans le vide', async () => {
  const db = await freshDb()
  const dangling = one(db, `
    SELECT COUNT(*) AS n FROM sentence_word sw
     WHERE NOT EXISTS (SELECT 1 FROM word w WHERE w.id = sw.word_id)
        OR NOT EXISTS (SELECT 1 FROM sentence s WHERE s.id = sw.sentence_id)`).n
  assert.equal(dangling, 0)
})

test('les niveaux de phrases sont equilibres', async () => {
  const db = await freshDb()
  const levels = rows(db, 'SELECT level, COUNT(*) AS n FROM sentence GROUP BY level ORDER BY level')
  assert.deepEqual(levels.map(l => l.level), [1, 2, 3, 4])
  for (const l of levels) assert.ok(l.n >= 500, `niveau ${l.level} : seulement ${l.n} phrases`)
})

test('la vue du contenu expose tout ce qui peut devenir une carte', async () => {
  const db = await freshDb()
  const byScript = rows(db, 'SELECT script, COUNT(*) AS n FROM content GROUP BY script')
  const map = Object.fromEntries(byScript.map(r => [r.script, r.n]))
  assert.equal(map.kanji, 2136)
  assert.equal(map.sentence, 6000)
  assert.equal(map.hiragana, 102, 'les deux kana quasi disparus sont exclus')
  // Le rang n'a pas besoin d'etre unique globalement — あ et ア partagent le leur —
  // mais il doit l'etre au sein d'une famille, car c'est la que l'alternance ordonne.
  const collisions = one(db, `
    SELECT COUNT(*) AS n FROM (
      SELECT script, ord FROM content GROUP BY script, ord HAVING COUNT(*) > 1
    )`).n
  assert.equal(collisions, 0, 'deux elements d une meme famille se disputent un rang')
})

test('le cours tient debout', async () => {
  const db = await freshDb()
  assert.ok(count(db, 'lesson') > 0)
  const orphans = one(db, `
    SELECT COUNT(*) AS n FROM lesson_item li
     WHERE NOT EXISTS (SELECT 1 FROM lesson l WHERE l.id = li.lesson_id)`).n
  assert.equal(orphans, 0)
})
