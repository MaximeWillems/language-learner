import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import app from '../.test-build/api/index.js'
import { call } from './d1.mjs'
import { LANG, NOW, USER, freshDb, one, rows } from './db.mjs'

async function deck(picks = [['hiragana', 'gojuon'], ['kanji', 'grade1'], ['sentence', 'level1'], ['word', 'w1']]) {
  const db = await freshDb()
  for (const [script, grp] of picks) {
    db.run(`INSERT INTO deck_selection (user_id, lang, script, grp, added_at) VALUES (?,?,?,?,?)`,
      [USER, LANG, script, grp, NOW])
  }
  return db
}

test('une seance filtree par famille repond', async () => {
  // Regression : le filtre etait qualifie par un remplacement de chaine dont la regex
  // contenait des caracteres de controle. Elle ne correspondait a rien, le filtre
  // arrivait non qualifie, et SQLite refusait la requete — `content` et
  // `deck_selection` portent tous deux une colonne `script`. Toutes les revisions
  // normales renvoyaient 500 ; seule la file sans filtre passait.
  const db = await deck()
  for (const scripts of ['hiragana,katakana,kanji', 'sentence', 'word']) {
    const r = await call(app, db, `/api/queue?limit=20&scripts=${scripts}`)
    assert.equal(r.status, 200, `${scripts} : ${JSON.stringify(r.body)}`)
    assert.ok(r.body.cards.length > 0)
    const familles = new Set(r.body.cards.map(c => c.script))
    for (const f of familles) assert.ok(scripts.split(',').includes(f), `${f} n a rien a faire la`)
  }
})

test('un filtre par groupe ne rend pas la requete ambigue', async () => {
  // `grp` existe aussi bien sur `content` que sur `deck_selection`
  const db = await deck()
  const r = await call(app, db, '/api/queue?limit=10&scripts=sentence&groups=level1')
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.ok(r.body.cards.every(c => c.grp === 'level1'))
})

test('la file sans filtre melange les familles', async () => {
  const db = await deck()
  const r = await call(app, db, '/api/queue?limit=20')
  assert.equal(r.status, 200)
  assert.ok(new Set(r.body.cards.map(c => c.script)).size >= 3)
})

test('chaque carte servie est complete', async () => {
  const db = await deck()
  const r = await call(app, db, '/api/queue?limit=30')
  for (const c of r.body.cards) {
    assert.ok(c.id > 0, 'identifiant manquant')
    assert.ok(c.text, `texte vide pour ${c.kind}/${c.script}`)
    assert.ok(c.previews && c.previews[1] && c.previews[3], 'intervalles manquants')
    if (c.choices.length) assert.equal(c.choices.length, 4, `${c.kind}/${c.script} : ${c.choices.length} choix`)
    if (c.kind === 'cloze') {
      assert.ok(c.words.length > 0 && c.blank >= 0 && c.blank < c.words.length)
      assert.ok(c.choices.includes(c.words[c.blank]), 'la bonne reponse doit figurer parmi les choix')
    }
    if (c.kind === 'meaning' && c.script !== 'sentence') assert.ok(c.meanings.length > 0)
  }
})

test('un mot sert son sens et sa lecture', async () => {
  const db = await deck([['word', 'w1']])
  const r = await call(app, db, '/api/queue?limit=20&scripts=word')
  assert.equal(r.status, 200)
  const meaning = r.body.cards.find(c => c.kind === 'meaning')
  assert.ok(meaning.meanings[0].length > 1)
  assert.equal(meaning.meaningLang, 'fr')
  for (const c of r.body.cards) {
    if (c.kind === 'reading') assert.ok(c.reading, `${c.text} sans lecture`)
  }
})

test('repondre replanifie la carte et la journalise', async () => {
  const db = await deck([['kanji', 'grade1']])
  const q = await call(app, db, '/api/queue?limit=6&scripts=kanji')
  const card = q.body.cards[0]

  const r = await call(app, db, '/api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cardId: card.id, rating: 3, answer: 'test', correct: true })
  })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.ok(r.body.due && r.body.interval)
  assert.ok(r.body.previews[1], 'les nouveaux intervalles doivent revenir pour la reinsertion')

  const after = one(db, 'SELECT state, reps FROM card WHERE id = ?', [card.id])
  assert.ok(after.state !== 0 && after.reps === 1)
  assert.equal(rows(db, "SELECT 1 FROM review_log WHERE card_id = ? AND mode = 'review'", [card.id]).length, 1)
})

test('l entrainement libre journalise sans replanifier', async () => {
  const db = await deck([['kanji', 'grade1']])
  const q = await call(app, db, '/api/queue?limit=4&scripts=kanji')
  const id = q.body.cards[0].id
  const before = one(db, 'SELECT due, state, reps FROM card WHERE id = ?', [id])

  const r = await call(app, db, '/api/practice/log', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cardId: id, answer: 'x', correct: false })
  })
  assert.equal(r.status, 200)
  assert.deepEqual(one(db, 'SELECT due, state, reps FROM card WHERE id = ?', [id]), before)
})

test('choisir du contenu n ecrit qu une ligne par groupe', async () => {
  const db = await freshDb()
  const r = await call(app, db, '/api/deck', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scripts: ['sentence'], groups: ['level1', 'level2', 'level3', 'level4'] })
  })
  assert.equal(r.status, 200)
  assert.equal(rows(db, 'SELECT 1 FROM deck_selection').length, 4)
  assert.equal(rows(db, 'SELECT 1 FROM card').length, 0, 'aucune carte avant la premiere seance')
})

test('les autres routes de lecture repondent', async () => {
  const db = await deck()
  for (const path of ['/api/counts', '/api/stats', '/api/course', '/api/version', '/api/cards/hard']) {
    const r = await call(app, db, path)
    assert.equal(r.status, 200, `${path} : ${JSON.stringify(r.body)}`)
  }
})

test('une carte inconnue rend 404, pas 500', async () => {
  const db = await deck()
  const r = await call(app, db, '/api/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cardId: 999999, rating: 3, answer: null, correct: true })
  })
  assert.equal(r.status, 404)
})
