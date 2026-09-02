import { Hono } from 'hono'
import type { Grade } from 'ts-fsrs'
import type { Counts, DeckRequest, QueueCard, Script } from '../shared/types'
import { VERSION } from '../shared/version'
import { apply, blank, fromRow, label, previews, type CardRow } from './srs'

type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } }

const LANG = 'ja'
const DEFAULT_NEW_PER_DAY = 20

interface Row extends CardRow {
  kind: 'reading' | 'recall' | 'meaning'
  glyph: string
  reading: string
  script: Script
  grp: string
  meanings: string | null
  meaning_lang: string | null
  on_readings: string | null
  kun_readings: string | null
  strokes: number | null
}

interface Kana { glyph: string; reading: string; kind: Script }

const list = (raw: string | null): string[] => {
  if (!raw) return []
  try { return JSON.parse(raw) as string[] } catch { return [] }
}

const pick = <T,>(from: T[], n: number, skip: (v: T) => boolean): T[] => {
  const out = new Set<T>()
  let guard = 0
  while (out.size < n && guard++ < from.length * 4) {
    const v = from[Math.floor(Math.random() * from.length)]
    if (v !== undefined && !skip(v)) out.add(v)
  }
  return [...out]
}

const COLS = `c.id, c.kind, c.due, c.stability, c.difficulty, c.elapsed_days, c.scheduled_days,
         c.learning_steps, c.reps, c.lapses, c.state, c.last_review,
         ch.glyph, ch.reading, ch.kind AS script, ch.grp,
         ch.meanings, ch.meaning_lang, ch.on_readings, ch.kun_readings, ch.strokes`

const FROM = `
    FROM card c
    JOIN character ch ON ch.id = c.item_id
   WHERE c.user_id = ? AND c.lang = ? AND c.suspended = 0 AND c.item_type = 'character'`

const SELECT = `SELECT ${COLS}${FROM}`

// Les nouvelles cartes sont servies en alternance entre ecritures. Sans ca, un tri global
// unique fait passer les 208 kana (ord 0-103) avant le premier kanji (ord 1000+) : ajouter
// des kanji ne donne rien a reviser pendant des jours.
const NEW_CARDS = `
  SELECT * FROM (
    SELECT ${COLS},
           ROW_NUMBER() OVER (PARTITION BY ch.kind ORDER BY ch.ord, c.kind) AS rn
      ${FROM} AND c.state = 0
  )
   WHERE rn <= ?
   ORDER BY rn, script
   LIMIT ?`

const ph = (n: number) => Array(n).fill('?').join(',')
const who = (h: string | undefined) => h ?? 'local'
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString() }

async function newPerDay(db: D1Database, u: string): Promise<number> {
  const row = await db.prepare(`SELECT value FROM setting WHERE user_id=? AND key='new_per_day'`)
    .bind(u).first<{ value: string }>()
  const n = Number(row?.value)
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_NEW_PER_DAY
}

async function counts(db: D1Database, u: string): Promise<Counts> {
  const now = new Date().toISOString()
  const day = dayStart()
  const cap = await newPerDay(db, u)
  const res = await db.batch<{ n: number }>([
    db.prepare(`SELECT COUNT(*) n FROM card WHERE user_id=? AND lang=? AND suspended=0`).bind(u, LANG),
    db.prepare(`SELECT COUNT(*) n FROM card WHERE user_id=? AND lang=? AND suspended=0 AND state<>0 AND due<=?`).bind(u, LANG, now),
    db.prepare(`SELECT COUNT(*) n FROM card WHERE user_id=? AND lang=? AND suspended=0 AND state=0`).bind(u, LANG),
    db.prepare(`SELECT COUNT(*) n FROM card WHERE user_id=? AND lang=? AND introduced_at>=?`).bind(u, LANG, day),
    db.prepare(`SELECT COUNT(*) n FROM card WHERE user_id=? AND lang=? AND state<>0`).bind(u, LANG),
    db.prepare(`SELECT COUNT(*) n FROM review_log l JOIN card c ON c.id=l.card_id WHERE c.user_id=? AND l.reviewed_at>=?`).bind(u, day)
  ])
  const n = (i: number) => res[i].results[0]?.n ?? 0

  const deck = await db.prepare(
    `SELECT ch.kind AS script, c.kind AS kind, COUNT(*) AS n
       FROM card c JOIN character ch ON ch.id = c.item_id
      WHERE c.user_id = ? AND c.lang = ? AND c.suspended = 0
      GROUP BY ch.kind, c.kind`
  ).bind(u, LANG).all<Counts['deck'][number]>()

  return {
    deck: deck.results,
    cards: n(0),
    dueNow: n(1),
    newAvailable: n(2),
    newPerDay: cap,
    newLeftToday: Math.max(0, cap - n(3)),
    learned: n(4),
    reviewsToday: n(5)
  }
}

function interleave(due: Row[], fresh: Row[]): Row[] {
  const out: Row[] = []
  let d = 0, f = 0
  while (d < due.length || f < fresh.length) {
    for (let i = 0; i < 4 && d < due.length; i++) out.push(due[d++])
    if (f < fresh.length) out.push(fresh[f++])
  }
  return out
}

function toCard(row: Row, kana: Kana[], senses: string[], now: Date): QueueCard {
  const meanings = list(row.meanings)
  const choices: string[] = []

  if (row.kind === 'recall') {
    const others = kana.filter(k => k.kind === row.script && k.reading !== row.reading)
    choices.push(row.glyph, ...pick(others, 3, k => k.glyph === row.glyph).map(k => k.glyph))
    choices.sort(() => Math.random() - 0.5)
  } else if (row.kind === 'meaning' && meanings.length) {
    choices.push(meanings[0], ...pick(senses, 3, v => meanings.includes(v)))
    choices.sort(() => Math.random() - 0.5)
  }

  return {
    id: row.id,
    kind: row.kind,
    glyph: row.glyph,
    reading: row.reading,
    script: row.script,
    grp: row.grp,
    isNew: row.state === 0,
    choices,
    previews: previews(fromRow(row), now),
    meanings,
    meaningLang: row.meaning_lang ?? 'fr',
    onReadings: list(row.on_readings),
    kunReadings: list(row.kun_readings),
    strokes: row.strokes
  }
}

const api = new Hono<Env>()

api.get('/version', c => c.json({ version: VERSION }))

api.get('/counts', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  return c.json(await counts(c.env.DB, u))
})

api.get('/groups', async c => {
  const r = await c.env.DB.prepare(
    `SELECT grp, kind, COUNT(*) n FROM character WHERE lang=? GROUP BY grp, kind ORDER BY MIN(ord)`
  ).bind(LANG).all()
  return c.json(r.results)
})

api.post('/deck', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const body = await c.req.json<DeckRequest>()
  const scripts = body.scripts?.length ? body.scripts : ['hiragana']
  const groups = body.groups?.length ? body.groups : ['gojuon']
  const now = new Date()
  const due = blank(now).due.toISOString()

  const chars = await c.env.DB.prepare(
    `SELECT id, kind FROM character WHERE lang=? AND kind IN (${ph(scripts.length)}) AND grp IN (${ph(groups.length)}) ORDER BY ord`
  ).bind(LANG, ...scripts, ...groups).all<{ id: number; kind: string }>()

  const insert = c.env.DB.prepare(
    `INSERT OR IGNORE INTO card (user_id, lang, item_type, item_id, kind, due, created_at)
     VALUES (?, ?, 'character', ?, ?, ?, ?)`
  )
  const stmts = []
  for (const ch of chars.results) {
    const kinds = ch.kind === 'kanji' ? ['meaning', 'reading'] : ['reading', 'recall']
    for (const kind of kinds) {
      stmts.push(insert.bind(u, LANG, ch.id, kind, due, now.toISOString()))
    }
  }
  for (let i = 0; i < stmts.length; i += 100) await c.env.DB.batch(stmts.slice(i, i + 100))

  return c.json(await counts(c.env.DB, u))
})

api.get('/queue', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const limit = Math.min(60, Number(c.req.query('limit') ?? 20))
  const now = new Date()
  const ct = await counts(c.env.DB, u)

  const reviews = await c.env.DB.prepare(`${SELECT} AND c.state<>0 AND c.due<=? ORDER BY c.due LIMIT ?`)
    .bind(u, LANG, now.toISOString(), limit).all<Row>()

  const room = Math.min(ct.newLeftToday, Math.max(0, limit - reviews.results.length))
  const fresh = room > 0
    ? (await c.env.DB.prepare(NEW_CARDS).bind(u, LANG, room, room).all<Row>()).results
    : []

  const queue = interleave(reviews.results, fresh)

  const kana = queue.some(r => r.kind === 'recall')
    ? (await c.env.DB.prepare(
        `SELECT glyph, reading, kind FROM character WHERE lang=? AND kind<>'kanji' AND grp<>'rare'`
      ).bind(LANG).all<Kana>()).results
    : []

  const senses = queue.some(r => r.kind === 'meaning')
    ? (await c.env.DB.prepare(
        `SELECT json_extract(meanings, '$[0]') AS m FROM character
          WHERE lang=? AND kind='kanji' AND meanings IS NOT NULL ORDER BY RANDOM() LIMIT 80`
      ).bind(LANG).all<{ m: string }>()).results.map(r => r.m).filter(Boolean)
    : []

  return c.json({
    cards: queue.map(r => toCard(r, kana, senses, now)),
    counts: ct
  })
})

api.post('/review', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const b = await c.req.json<{ cardId: number; rating: Grade; answer: string | null; correct: boolean }>()
  const now = new Date()

  const row = await c.env.DB.prepare(`SELECT * FROM card WHERE id=? AND user_id=?`)
    .bind(b.cardId, u).first<CardRow & { introduced_at: string | null }>()
  if (!row) return c.json({ error: 'carte introuvable' }, 404)

  const { card, log } = apply(fromRow(row), b.rating, now)
  const introduced = row.introduced_at ?? now.toISOString()

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE card SET due=?, stability=?, difficulty=?, elapsed_days=?, scheduled_days=?, learning_steps=?,
              reps=?, lapses=?, state=?, last_review=?, introduced_at=?
        WHERE id=?`
    ).bind(
      card.due.toISOString(), card.stability, card.difficulty, card.elapsed_days, card.scheduled_days,
      card.learning_steps ?? 0, card.reps, card.lapses, card.state, now.toISOString(), introduced, row.id
    ),
    c.env.DB.prepare(
      `INSERT INTO review_log (card_id, rating, state, due, stability, difficulty, elapsed_days,
                               last_elapsed_days, scheduled_days, reviewed_at, answer, correct)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(
      row.id, log.rating, log.state, log.due.toISOString(), log.stability, log.difficulty,
      log.elapsed_days, log.last_elapsed_days, log.scheduled_days, now.toISOString(),
      b.answer, b.correct ? 1 : 0
    )
  ])

  return c.json({ due: card.due.toISOString(), interval: label(card.due, now) })
})

api.post('/settings', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const b = await c.req.json<{ newPerDay?: number }>()
  if (typeof b.newPerDay === 'number' && b.newPerDay >= 0 && b.newPerDay <= 500) {
    await c.env.DB.prepare(
      `INSERT INTO setting (user_id, key, value) VALUES (?, 'new_per_day', ?)
       ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`
    ).bind(u, String(Math.round(b.newPerDay))).run()
  }
  return c.json(await counts(c.env.DB, u))
})

// Entrainement libre : tire au hasard dans le paquet, sans tenir compte des echeances
// ni du plafond quotidien. Ne modifie jamais la planification.
api.get('/practice', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const limit = Math.min(60, Number(c.req.query('limit') ?? 30))
  const now = new Date()
  const csv = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : [])
  const scripts = csv(c.req.query('scripts'))
  const groups = csv(c.req.query('groups'))
  const kinds = csv(c.req.query('kinds'))

  const clauses: string[] = []
  const args: unknown[] = [u, LANG]
  if (scripts.length) { clauses.push(`ch.kind IN (${ph(scripts.length)})`); args.push(...scripts) }
  if (groups.length) { clauses.push(`ch.grp IN (${ph(groups.length)})`); args.push(...groups) }
  if (kinds.length) { clauses.push(`c.kind IN (${ph(kinds.length)})`); args.push(...kinds) }
  const filter = clauses.length ? ' AND ' + clauses.join(' AND ') : ''

  const rows = (await c.env.DB.prepare(`${SELECT}${filter} ORDER BY RANDOM() LIMIT ?`)
    .bind(...args, limit).all<Row>()).results

  const kana = rows.some(r => r.kind === 'recall')
    ? (await c.env.DB.prepare(
        `SELECT glyph, reading, kind FROM character WHERE lang=? AND kind<>'kanji' AND grp<>'rare'`
      ).bind(LANG).all<Kana>()).results
    : []

  const senses = rows.some(r => r.kind === 'meaning')
    ? (await c.env.DB.prepare(
        `SELECT json_extract(meanings, '$[0]') AS m FROM character
          WHERE lang=? AND kind='kanji' AND meanings IS NOT NULL ORDER BY RANDOM() LIMIT 80`
      ).bind(LANG).all<{ m: string }>()).results.map(r => r.m).filter(Boolean)
    : []

  return c.json({ cards: rows.map(r => toCard(r, kana, senses, now)), counts: await counts(c.env.DB, u) })
})

api.post('/practice/log', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const b = await c.req.json<{ cardId: number; answer: string | null; correct: boolean }>()
  const now = new Date().toISOString()

  const row = await c.env.DB.prepare(`SELECT * FROM card WHERE id=? AND user_id=?`)
    .bind(b.cardId, u).first<CardRow>()
  if (!row) return c.json({ error: 'carte introuvable' }, 404)

  await c.env.DB.prepare(
    `INSERT INTO review_log (card_id, rating, state, due, stability, difficulty,
                             elapsed_days, last_elapsed_days, scheduled_days,
                             reviewed_at, answer, correct, mode)
     VALUES (?,?,?,?,?,?,0,0,0,?,?,?,'practice')`
  ).bind(
    row.id, b.correct ? 3 : 1, row.state, row.due, row.stability, row.difficulty,
    now, b.answer, b.correct ? 1 : 0
  ).run()

  return c.json({ ok: true })
})

const app = new Hono<Env>()
app.route('/api', api)
app.all('*', async c => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.status !== 404) return res
  return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url), c.req.raw))
})

export default app
