import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { NEW_CARDS, PENDING } from '../.test-build/shared/sql.js'
import { LANG, NOW, USER, count, freshDb, materialize, one, rows, select } from './db.mjs'

const newCards = (db, room, filter = '', args = []) =>
  rows(db, NEW_CARDS.replace('${FILTER}', filter), [USER, LANG, ...args, room, room])

test('les nouveautes alternent entre familles', async () => {
  // Regression : un tri global sur `ord` faisait passer les 208 kana avant le premier
  // kanji, soit cinq jours d attente avant qu un kanji ajoute n apparaisse.
  const db = await freshDb()
  select(db, [['hiragana', 'gojuon'], ['kanji', 'grade1'], ['sentence', 'level1']])
  materialize(db, 30)

  const served = newCards(db, 12)
  const families = new Set(served.map(r => r.script))
  assert.equal(families.size, 3, `une seule famille servie : ${[...families]}`)
  assert.ok(served.slice(0, 4).some(r => r.script === 'kanji'), 'un kanji doit sortir tot')
})

test('une seance filtree ne sert que sa famille', async () => {
  const db = await freshDb()
  select(db, [['hiragana', 'gojuon'], ['sentence', 'level1']])
  materialize(db, 20)

  const served = newCards(db, 8, ' AND script IN (?)', ['sentence'])
  assert.ok(served.length > 0)
  assert.ok(served.every(r => r.script === 'sentence'))
})

test('la composition du paquet ne confond pas phrases et caracteres', async () => {
  // Regression : joindre `card` a `character` sur item_id sans verifier le type comptait
  // les 900 cartes de phrase comme des kanji et des kana.
  const db = await freshDb()
  select(db, [['sentence', 'level1'], ['hiragana', 'gojuon']])
  materialize(db, 20)

  const deck = rows(db, `
    SELECT script, kind, COUNT(*) AS n FROM card_item
     WHERE user_id = ? AND lang = ? AND suspended = 0 GROUP BY script, kind`, [USER, LANG])

  assert.equal(deck.reduce((a, d) => a + d.n, 0), count(db, 'card'))
  const sentences = deck.filter(d => d.script === 'sentence').reduce((a, d) => a + d.n, 0)
  assert.ok(sentences > 0)
  assert.deepEqual(
    deck.filter(d => d.script === 'sentence').map(d => d.kind).sort(),
    ['cloze', 'meaning']
  )
})

test('choisir tout le contenu coute quelques lignes, pas des milliers', async () => {
  // Regression : la creation anticipee ecrivait 12 000 lignes pour les phrases seules,
  // ce qui a fait toucher le plafond quotidien de D1.
  const db = await freshDb()
  const picks = [
    ['sentence', 'level1'], ['sentence', 'level2'], ['sentence', 'level3'], ['sentence', 'level4'],
    ['hiragana', 'gojuon'], ['kanji', 'grade1']
  ]
  select(db, picks)
  assert.equal(count(db, 'deck_selection'), picks.length)
  assert.equal(count(db, 'card'), 0, 'rien ne doit etre materialise a la selection')

  const waiting = one(db, `SELECT COUNT(*) AS n ${PENDING}`, [USER, LANG]).n
  assert.ok(waiting > 6000)

  const { written } = materialize(db, 10)
  assert.equal(written, 20, 'une seance de 20 nouveautes ecrit 20 lignes')
})

test('un element deja materialise ne repasse pas en attente', async () => {
  const db = await freshDb()
  select(db, [['kanji', 'grade1']])
  const before = one(db, `SELECT COUNT(*) AS n ${PENDING}`, [USER, LANG]).n
  materialize(db, 5)
  const after = one(db, `SELECT COUNT(*) AS n ${PENDING}`, [USER, LANG]).n
  assert.equal(before - after, 5)

  const again = materialize(db, 5)
  assert.ok(again.picked.every(p => p.item_id > 213), 'la seconde vague reprend la suite')
})

test('une carte mise de cote sort de la file sans disparaitre', async () => {
  const db = await freshDb()
  select(db, [['kanji', 'grade1']])
  materialize(db, 3)
  const id = one(db, 'SELECT id FROM card LIMIT 1').id

  db.run('UPDATE card SET suspended = 1 WHERE id = ? AND user_id = ?', [id, USER])
  assert.equal(count(db, `card_item WHERE id = ${id} AND suspended = 0`), 0)
  assert.equal(count(db, `card WHERE id = ${id}`), 1, 'la carte existe toujours')
})

test('la remise a zero efface la planification et garde l historique', async () => {
  const db = await freshDb()
  select(db, [['kanji', 'grade1']])
  materialize(db, 2)
  const id = one(db, 'SELECT id FROM card LIMIT 1').id

  db.run(`UPDATE card SET state=2, lapses=9, reps=17, stability=1.4, difficulty=8.9, last_review=? WHERE id=?`, [NOW, id])
  for (let i = 0; i < 5; i++) {
    db.run(`INSERT INTO review_log (card_id,rating,state,due,stability,difficulty,elapsed_days,
            last_elapsed_days,scheduled_days,reviewed_at,answer,correct,mode)
            VALUES (?,1,2,?,1.4,8.9,1,1,1,?,NULL,0,'review')`, [id, NOW, NOW])
  }

  db.run(`UPDATE card SET state=0, stability=0, difficulty=0, elapsed_days=0, scheduled_days=0,
          learning_steps=0, reps=0, lapses=0, last_review=NULL, introduced_at=NULL,
          suspended=0, due=? WHERE id=? AND user_id=?`, [NOW, id, USER])

  const card = one(db, 'SELECT state, lapses, reps FROM card WHERE id = ?', [id])
  assert.deepEqual(card, { state: 0, lapses: 0, reps: 0 })
  assert.equal(count(db, `review_log WHERE card_id = ${id}`), 5, 'l historique dit que la carte a pose probleme')
})

test('l entrainement libre ne touche jamais a la planification', async () => {
  const db = await freshDb()
  select(db, [['kanji', 'grade1']])
  materialize(db, 2)
  const id = one(db, 'SELECT id FROM card LIMIT 1').id
  db.run('UPDATE card SET state=2, due=?, stability=12.5, difficulty=4.2, reps=3 WHERE id=?',
    ['2026-10-15T09:00:00.000Z', id])

  const before = one(db, 'SELECT due, stability, difficulty, state, reps FROM card WHERE id = ?', [id])
  for (let i = 0; i < 3; i++) {
    db.run(`INSERT INTO review_log (card_id,rating,state,due,stability,difficulty,elapsed_days,
            last_elapsed_days,scheduled_days,reviewed_at,answer,correct,mode)
            VALUES (?,3,2,?,12.5,4.2,0,0,0,?,'a',1,'practice')`, [id, before.due, NOW])
  }
  const after = one(db, 'SELECT due, stability, difficulty, state, reps FROM card WHERE id = ?', [id])
  assert.deepEqual(after, before)
  assert.equal(count(db, "review_log WHERE mode = 'practice'"), 3)
})

test('les statistiques ne comptent que les vraies revisions', async () => {
  const db = await freshDb()
  select(db, [['kanji', 'grade1']])
  materialize(db, 2)
  const id = one(db, 'SELECT id FROM card LIMIT 1').id
  const log = (mode, correct) => db.run(
    `INSERT INTO review_log (card_id,rating,state,due,stability,difficulty,elapsed_days,
     last_elapsed_days,scheduled_days,reviewed_at,answer,correct,mode)
     VALUES (?,3,2,?,1,1,0,0,0,?,NULL,?,?)`, [id, NOW, NOW, correct, mode])

  log('review', 1); log('review', 0); log('practice', 1); log('practice', 1)
  const stats = one(db, `
    SELECT COUNT(*) AS n, SUM(COALESCE(l.correct,0)) AS ok
      FROM review_log l JOIN card c ON c.id = l.card_id
     WHERE c.user_id = ? AND l.mode = 'review'`, [USER])
  assert.deepEqual(stats, { n: 2, ok: 1 })
})

test('la mesure de capacite reflete ce qu on sait vraiment', async () => {
  const { ALMOST, READABLE } = await import('../.test-build/shared/sql.js')
  const db = await freshDb()
  const known = n => {
    for (const k of rows(db, `SELECT id FROM character WHERE kind='kanji' ORDER BY ord LIMIT ${n}`)) {
      db.run(`INSERT OR IGNORE INTO card (user_id,lang,item_type,item_id,kind,due,created_at,state)
              VALUES (?,?,'character',?,'meaning',?,?,2)`, [USER, LANG, k.id, NOW, NOW])
    }
    return one(db, READABLE, [LANG, USER]).n
  }

  const none = one(db, READABLE, [LANG, USER]).n
  assert.ok(none < 10, 'sans kanji, presque rien n est lisible')

  const at200 = known(200)
  const at500 = known(500)
  assert.ok(at200 > none && at500 > at200, `la mesure doit monter : ${none} -> ${at200} -> ${at500}`)

  // les kanji sont classes par frequence : les 300 suivants doivent rapporter gros
  assert.ok(at500 - at200 > 500, `seulement ${at500 - at200} phrases gagnees entre 200 et 500 kanji`)

  const almost = one(db, ALMOST, [LANG, USER]).n
  assert.ok(almost > 0, 'des phrases doivent etre a un kanji pres')

  // oublier fait redescendre la mesure : c est ce qui la rend credible
  db.run("UPDATE card SET state = 1 WHERE item_type = 'character'")
  assert.equal(one(db, READABLE, [LANG, USER]).n, none)
})

test('une carte mise de cote ne compte pas comme acquise', async () => {
  const { READABLE } = await import('../.test-build/shared/sql.js')
  const db = await freshDb()
  for (const k of rows(db, "SELECT id FROM character WHERE kind='kanji' ORDER BY ord LIMIT 400")) {
    db.run(`INSERT OR IGNORE INTO card (user_id,lang,item_type,item_id,kind,due,created_at,state)
            VALUES (?,?,'character',?,'meaning',?,?,2)`, [USER, LANG, k.id, NOW, NOW])
  }
  const before = one(db, READABLE, [LANG, USER]).n
  db.run("UPDATE card SET suspended = 1 WHERE item_type = 'character'")
  assert.ok(one(db, READABLE, [LANG, USER]).n < before)
})
