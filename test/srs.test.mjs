import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { apply, blank, fromRow, label, previews } from '../.test-build/api/srs.js'

const NOW = new Date('2026-09-02T09:00:00Z')
const MINUTE = 60000
const DAY = 86400000
const gap = (card, from) => card.due.getTime() - from.getTime()

test('une carte neuve part a zero et est due tout de suite', () => {
  const c = blank(NOW)
  assert.equal(c.state, 0)
  assert.equal(c.reps, 0)
  assert.equal(c.lapses, 0)
  assert.equal(c.due.getTime(), NOW.getTime())
})

test('une carte neuve revient en minutes, pas en jours', () => {
  // c'est ce qui impose de la reinserer dans la seance en cours
  const p = previews(blank(NOW), NOW)
  for (const rating of [1, 2, 3]) assert.match(p[rating], /min$/, `note ${rating} : ${p[rating]}`)
  assert.match(p[4], /j$/)
})

test('deux « bon » font passer des minutes aux jours', () => {
  const first = apply(blank(NOW), 3, NOW)
  assert.ok(gap(first.card, NOW) < 20 * MINUTE, 'le premier « bon » reste dans la seance')

  const at = new Date(first.card.due)
  const second = apply(first.card, 3, at)
  assert.ok(gap(second.card, at) > DAY, 'le second « bon » sort en jours')
  assert.equal(second.card.reps, 2)
})

test('un echec ramene la carte tout de suite et la rend plus difficile', () => {
  let card = blank(NOW)
  let at = NOW
  for (let i = 0; i < 3; i++) {
    const r = apply(card, 3, at)
    card = r.card
    at = new Date(card.due)
  }
  const before = card.difficulty
  const failed = apply(card, 1, at).card

  assert.ok(gap(failed, at) < 20 * MINUTE, 'revient dans la seance')
  assert.ok(failed.difficulty > before, 'la difficulte monte')
  assert.equal(failed.lapses, 1)
})

test('« facile » espace davantage que « bon »', () => {
  const p = previews(blank(NOW), NOW)
  const good = apply(blank(NOW), 3, NOW).card
  const easy = apply(blank(NOW), 4, NOW).card
  assert.ok(easy.due > good.due, `facile ${p[4]} devrait depasser bon ${p[3]}`)
})

test('l aller-retour par la base ne perd rien', () => {
  const c = apply(blank(NOW), 3, NOW).card
  const row = {
    id: 1,
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    learning_steps: c.learning_steps ?? 0,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.toISOString() : null
  }
  const back = fromRow(row)
  assert.equal(back.state, c.state)
  assert.equal(back.stability, c.stability)
  assert.equal(back.difficulty, c.difficulty)
  assert.equal(back.reps, c.reps)
  assert.equal(back.due.getTime(), c.due.getTime())
})

test('le journal enregistre la note donnee', () => {
  const { log } = apply(blank(NOW), 2, NOW)
  assert.equal(log.rating, 2)
  assert.ok(log.due instanceof Date)
})

test('les intervalles s ecrivent en francais lisible', () => {
  const at = t => label(new Date(NOW.getTime() + t), NOW)
  assert.equal(at(0), 'maintenant')
  assert.equal(at(10 * MINUTE), '10 min')
  assert.equal(at(3 * 3600000), '3 h')
  assert.equal(at(5 * DAY), '5 j')
  assert.equal(at(60 * DAY), '2 mois')
  assert.match(at(400 * DAY), /ans$/)
})
