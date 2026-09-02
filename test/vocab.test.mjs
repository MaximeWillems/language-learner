import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import initSqlJs from 'sql.js'
import { countWrites, isWrite } from '../scripts/count-writes.mjs'
import { LANG, NOW, USER, count, freshDb, materialize, one, rows, select } from './db.mjs'

test('presque tout le vocabulaire a un sens', async () => {
  const db = await freshDb()
  assert.equal(count(db, 'word'), 2509)
  assert.ok(count(db, "word WHERE gloss <> ''") > 2450)
})

test('les mots les plus frequents sont tous traduits en francais', async () => {
  const db = await freshDb()
  const head = rows(db, "SELECT lemma, gloss, gloss_lang FROM word WHERE grp = 'w1' ORDER BY ord")
  assert.equal(head.length, 150)
  const english = head.filter(w => w.gloss_lang !== 'fr')
  assert.equal(english.length, 0, `en anglais : ${english.map(w => w.lemma).join(' ')}`)
  for (const w of head) assert.ok(w.gloss.length > 1, `${w.lemma} sans sens`)
})

test('les particules sont expliquees, pas traduites mot a mot', async () => {
  const db = await freshDb()
  const wa = one(db, "SELECT gloss FROM word WHERE lemma = 'は' AND gloss <> ''")
  assert.match(wa.gloss, /thème/, `は explique par « ${wa.gloss} »`)
  const wo = one(db, "SELECT gloss FROM word WHERE lemma = 'を' AND gloss <> ''")
  assert.match(wo.gloss, /objet/)
})

test('la lecture retenue est celle que le corpus emploie', async () => {
  const db = await freshDb()
  // 人 se lit ひと 3 068 fois contre じん 17 : JMdict seul aurait choisi le suffixe
  const hito = one(db, "SELECT reading, gloss FROM word WHERE lemma = '人' ORDER BY freq DESC LIMIT 1")
  assert.equal(hito.reading, 'ひと')
  assert.match(hito.gloss, /personne/)
  assert.equal(one(db, "SELECT reading FROM word WHERE lemma = '本' ORDER BY freq DESC LIMIT 1").reading, 'ほん')
  assert.equal(one(db, "SELECT reading FROM word WHERE lemma = '為る' ORDER BY freq DESC LIMIT 1").reading, 'する')
})

test('le classement suit la frequence reelle dans le corpus', async () => {
  const db = await freshDb()
  const top = rows(db, 'SELECT lemma, freq FROM word ORDER BY ord LIMIT 5')
  assert.equal(top[0].lemma, 'は')
  for (let i = 1; i < top.length; i++) assert.ok(top[i].freq <= top[i - 1].freq)
})

test('un mot en kana seul ne recoit pas de carte de lecture', async () => {
  const db = await freshDb()
  select(db, [['word', 'w1']])
  materialize(db, 40)
  const kana = rows(db, `
    SELECT ci.kind, ci.text FROM card_item ci
     WHERE ci.user_id = ? AND ci.script = 'word' AND ci.text NOT GLOB '*[一-龯]*'`, [USER])
  assert.ok(kana.length > 0)
  assert.ok(kana.every(c => c.kind === 'meaning'),
    'demander la lecture de は reviendrait a recopier ce qui est affiche')

  const withKanji = rows(db, `
    SELECT ci.kind FROM card_item ci
     WHERE ci.user_id = ? AND ci.script = 'word' AND ci.text GLOB '*[一-龯]*'`, [USER])
  assert.ok(withKanji.some(c => c.kind === 'reading'))
})

test('une carte de mot traverse la vue avec son sens', async () => {
  const db = await freshDb()
  select(db, [['word', 'w1']])
  materialize(db, 3)
  const card = one(db, `
    SELECT text, reading, script, meanings, meaning_lang FROM card_item
     WHERE user_id = ? AND kind = 'meaning' AND script = 'word' LIMIT 1`, [USER])
  assert.equal(card.script, 'word')
  assert.equal(card.meaning_lang, 'fr')
  const parsed = JSON.parse(card.meanings)
  assert.equal(parsed.length, 1)
  assert.ok(parsed[0].length > 1)
})

test('le vocabulaire entre dans l alternance comme les autres familles', async () => {
  const db = await freshDb()
  select(db, [['word', 'w1'], ['kanji', 'grade1'], ['sentence', 'level1']])
  const { picked } = materialize(db, 9)
  assert.equal(new Set(picked.map(p => p.script)).size, 3)
})

test('le compteur de budget voit les mises a jour, pas seulement les insertions', async () => {
  // Il s'etait trompe deux fois : d'abord en ne comptant que les lignes ajoutees, puis
  // en recomptant l'instruction precedente apres un CREATE TABLE.
  const SQL = await initSqlJs()
  const db = new SQL.Database()
  db.run('CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)')
  assert.equal(countWrites(db, `INSERT INTO t VALUES (1,'a'),(2,'b'),(3,'c');`), 3)
  assert.equal(countWrites(db, `UPDATE t SET v = 'z' WHERE id <= 2;`), 2)
  assert.equal(countWrites(db, `DELETE FROM t WHERE id = 3;`), 1)
  assert.equal(countWrites(db, `CREATE TABLE u (a); CREATE INDEX i ON u(a);`), 0,
    'le DDL n ecrit aucune ligne')
  assert.equal(countWrites(db, `-- un commentaire\n  UPDATE t SET v = 'y';`), 2,
    'un commentaire en tete ne doit pas masquer l instruction')
})

test('isWrite ne se laisse pas prendre par une vue qui lit', () => {
  assert.equal(isWrite('CREATE VIEW v AS SELECT * FROM t'), false)
  assert.equal(isWrite('DROP VIEW v'), false)
  assert.equal(isWrite('  \n  insert into t values (1)'), true)
  assert.equal(isWrite('-- commentaire\nUPDATE t SET a = 1'), true)
})
