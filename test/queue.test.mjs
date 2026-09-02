import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { blankIndex, interleave, pick, spread } from '../.test-build/shared/queue.js'

const card = (id, script = 'kanji') => ({ item_id: id, script })

test('les nouveautes se glissent une toutes les quatre revisions', () => {
  const due = [1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ d: n }))
  const fresh = [1, 2].map(n => ({ f: n }))
  const out = interleave(due, fresh)
  assert.equal(out.length, 10)
  assert.deepEqual(out[4], { f: 1 })
  assert.deepEqual(out[9], { f: 2 })
})

test('interleave ne perd rien meme quand une des deux listes est vide', () => {
  assert.equal(interleave([], [1, 2, 3]).length, 3)
  assert.equal(interleave([1, 2, 3], []).length, 3)
  assert.equal(interleave([], []).length, 0)
})

test('deux cartes du meme element ne se suivent pas', () => {
  // le texte a trous devoile la traduction que la carte de comprehension va demander
  const rows = [card(1), card(1), card(2), card(2), card(3), card(3)]
  const out = spread(rows)
  assert.equal(out.length, rows.length)
  let adjacent = 0
  for (let i = 1; i < out.length; i++) if (out[i].item_id === out[i - 1].item_id) adjacent++
  assert.ok(adjacent <= 1, `${adjacent} collisions, au plus une attendue en fin de file`)
})

test('spread preserve le contenu exact de la file', () => {
  const rows = [card(1), card(2), card(1), card(3), card(2)]
  const out = spread(rows)
  assert.deepEqual(out.map(r => r.item_id).sort(), [1, 1, 2, 2, 3])
})

test('le mot masque est stable pour une carte donnee', () => {
  const words = ['私', 'は', '学生', 'です']
  const first = blankIndex(7, words)
  for (let i = 0; i < 20; i++) assert.equal(blankIndex(7, words), first)
})

test('le mot masque evite les particules d un seul kana', () => {
  const words = ['私', 'は', '学生', 'です']
  for (let id = 0; id < 12; id++) {
    const w = words[blankIndex(id, words)]
    assert.ok(w.length >= 2 || /[一-龯]/.test(w), `« ${w} » est devinable sans rien savoir`)
  }
})

test('blankIndex reste defini quand rien ne convient', () => {
  assert.equal(blankIndex(3, ['は']), 0)
  assert.equal(blankIndex(3, []), 0)
})

test('pick ne boucle pas quand le vivier est entierement filtre', () => {
  const out = pick([1, 2, 3], 3, () => true)
  assert.deepEqual(out, [])
})

test('pick rend des valeurs distinctes et respecte le filtre', () => {
  const out = pick([1, 2, 3, 4, 5], 3, v => v === 5)
  assert.equal(out.length, 3)
  assert.equal(new Set(out).size, 3)
  assert.ok(!out.includes(5))
})
