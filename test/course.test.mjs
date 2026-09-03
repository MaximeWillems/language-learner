import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { kindsFor } from '../.test-build/shared/sql.js'
import { LANG, NOW, USER, count, freshDb, one, rows } from './db.mjs'

const LESSON_COVER = `
  SELECT li.lesson_id AS lesson_id,
         COUNT(DISTINCT li.item_type || ':' || li.item_id) AS items,
         COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN li.item_type || ':' || li.item_id END) AS owned,
         COUNT(DISTINCT CASE WHEN c.state = 2 THEN li.item_type || ':' || li.item_id END) AS known
    FROM lesson_item li
    LEFT JOIN card c
      ON c.item_type = li.item_type AND c.item_id = li.item_id
     AND c.user_id = ? AND c.suspended = 0
   GROUP BY li.lesson_id`

const complete = (db, lessonId, { words = [], sentences = [], state = 'done' } = {}) => {
  let written = 0
  for (const w of words) {
    const lemma = one(db, 'SELECT lemma FROM word WHERE id = ?', [w]).lemma
    for (const kind of kindsFor('word', lemma)) {
      db.run(`INSERT OR IGNORE INTO card (user_id,lang,item_type,item_id,kind,due,created_at)
              VALUES (?,?,'word',?,?,?,?)`, [USER, LANG, w, kind, NOW, NOW])
      written++
    }
  }
  for (const s of sentences) {
    for (const kind of ['meaning', 'cloze']) {
      db.run(`INSERT OR IGNORE INTO card (user_id,lang,item_type,item_id,kind,due,created_at)
              VALUES (?,?,'sentence',?,?,?,?)`, [USER, LANG, s, kind, NOW, NOW])
      written++
    }
  }
  db.run(`INSERT INTO lesson_progress (user_id, lesson_id, state, updated_at) VALUES (?,?,?,?)
          ON CONFLICT (user_id, lesson_id) DO UPDATE SET state = excluded.state`, [USER, lessonId, state, NOW])
  return written
}

test('le cours a des chapitres, des lecons et des elements', async () => {
  const db = await freshDb()
  const chapters = rows(db, 'SELECT id, pos, title FROM milestone ORDER BY pos')
  assert.ok(chapters.length >= 2)
  const lessons = rows(db, 'SELECT id, milestone_id, pos, title FROM lesson ORDER BY milestone_id, pos')
  assert.ok(lessons.length >= 5)
  for (const l of lessons) {
    assert.ok(chapters.some(c => c.id === l.milestone_id), `lecon ${l.id} orpheline`)
    assert.ok(l.title.length > 0)
  }
})

test('chaque lecon a une explication', async () => {
  const db = await freshDb()
  const lessons = rows(db, 'SELECT id, title, body FROM lesson')
  for (const l of lessons) {
    assert.ok(l.body && l.body.length > 40, `la lecon « ${l.title} » n a pas d explication`)
  }
  // Une lecon d'introduction peut n'introduire aucune carte : elle explique, et c'est
  // tout. Mais le cours dans son ensemble doit bien amener quelque chose.
  const teaching = lessons.filter(l =>
    one(db, 'SELECT COUNT(*) AS n FROM lesson_item WHERE lesson_id = ?', [l.id]).n > 0)
  assert.ok(teaching.length >= lessons.length - 2, 'trop de lecons purement explicatives')
  assert.ok(teaching.length > 0)
})

test('les elements d une lecon existent vraiment', async () => {
  const db = await freshDb()
  const dangling = one(db, `
    SELECT COUNT(*) AS n FROM lesson_item li
     WHERE (li.item_type = 'word'
            AND NOT EXISTS (SELECT 1 FROM word w WHERE w.id = li.item_id))
        OR (li.item_type = 'sentence'
            AND NOT EXISTS (SELECT 1 FROM sentence s WHERE s.id = li.item_id))`).n
  assert.equal(dangling, 0)
})

test('les mots enseignes ont tous un sens', async () => {
  const db = await freshDb()
  const mute = rows(db, `
    SELECT w.lemma FROM lesson_item li JOIN word w ON w.id = li.item_id
     WHERE li.item_type = 'word' AND (w.gloss IS NULL OR w.gloss = '')`)
  assert.equal(mute.length, 0, `sans sens : ${mute.map(w => w.lemma).join(' ')}`)
})

test('la couverture d une lecon part de zero', async () => {
  const db = await freshDb()
  for (const r of rows(db, LESSON_COVER, [USER])) {
    assert.ok(r.items > 0)
    assert.equal(r.owned, 0)
    assert.equal(r.known, 0)
  }
})

test('terminer une lecon n ajoute que ce qui a ete coche', async () => {
  const db = await freshDb()
  const lesson = one(db, `
    SELECT lesson_id AS id FROM lesson_item WHERE item_type = 'word'
     GROUP BY lesson_id HAVING COUNT(*) >= 2 ORDER BY lesson_id LIMIT 1`).id
  const items = rows(db, `SELECT item_type, item_id FROM lesson_item WHERE lesson_id = ? AND item_type = 'word'`, [lesson])
  assert.ok(items.length >= 2)

  // on n en coche qu un seul : rien d autre ne doit entrer dans le paquet
  complete(db, lesson, { words: [items[0].item_id] })
  const owned = rows(db, `SELECT DISTINCT item_id FROM card WHERE item_type = 'word'`)
  assert.deepEqual(owned.map(o => o.item_id), [items[0].item_id])

  const cover = rows(db, LESSON_COVER, [USER]).find(r => r.lesson_id === lesson)
  assert.equal(cover.owned, 1)
})

test('un mot en kana ne recoit pas de carte de lecture, meme via une lecon', async () => {
  // La fin de lecon creait deux cartes par mot sans regarder son ecriture : demander
  // la lecture de で revient a recopier ce qui est affiche.
  const db = await freshDb()
  const kana = one(db, `
    SELECT li.lesson_id, li.item_id, w.lemma FROM lesson_item li
      JOIN word w ON w.id = li.item_id
     WHERE li.item_type = 'word' AND w.lemma NOT GLOB '*[一-龯]*' LIMIT 1`)
  assert.ok(kana, 'le cours doit contenir au moins un mot en kana')

  complete(db, kana.lesson_id, { words: [kana.item_id] })
  const kinds = rows(db, `SELECT kind FROM card WHERE item_type='word' AND item_id=?`, [kana.item_id])
  assert.deepEqual(kinds.map(k => k.kind), ['meaning'], `« ${kana.lemma} » ne doit avoir qu une carte`)
})

test('marquer une lecon comme deja connue n ajoute aucune carte', async () => {
  const db = await freshDb()
  const lesson = one(db, 'SELECT id FROM lesson ORDER BY id LIMIT 1').id
  complete(db, lesson, { state: 'known' })
  assert.equal(count(db, 'card'), 0)
  assert.equal(one(db, 'SELECT state FROM lesson_progress WHERE lesson_id = ?', [lesson]).state, 'known')
})

test('reprendre une lecon met a jour son etat sans la dupliquer', async () => {
  const db = await freshDb()
  const lesson = one(db, 'SELECT id FROM lesson ORDER BY id LIMIT 1').id
  complete(db, lesson, { state: 'known' })
  complete(db, lesson, { state: 'done' })
  assert.equal(count(db, 'lesson_progress'), 1)
  assert.equal(one(db, 'SELECT state FROM lesson_progress WHERE lesson_id = ?', [lesson]).state, 'done')
})

test('rien ne verrouille : aucune lecon ne depend d une autre', async () => {
  const db = await freshDb()
  const cols = rows(db, `SELECT name FROM pragma_table_info('lesson')`).map(c => c.name)
  for (const forbidden of ['requires', 'depends_on', 'locked', 'prerequisite']) {
    assert.ok(!cols.includes(forbidden), `« ${forbidden} » réintroduirait un parcours imposé`)
  }
})
