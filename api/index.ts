import { Hono } from 'hono'
import type { Grade } from 'ts-fsrs'
import type { CardAction, CardKind, Counts, DeckRequest, QueueCard, Script } from '../shared/types'
import { LEECH } from '../shared/types'
import { VERSION } from '../shared/version'
import { apply, blank, fromRow, label, previews, type CardRow } from './srs'

type Env = { Bindings: { DB: D1Database; ASSETS: Fetcher } }

const LANG = 'ja'
const DEFAULT_NEW_PER_DAY = 20

interface Row extends CardRow {
  item_id: number
  kind: 'reading' | 'recall' | 'meaning' | 'cloze'
  text: string
  reading: string
  script: Script
  grp: string
  meanings: string | null
  meaning_lang: string | null
  on_readings: string | null
  kun_readings: string | null
  strokes: number | null
  translation: string | null
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

const COLS = `id, item_id, kind, due, stability, difficulty, elapsed_days, scheduled_days,
         learning_steps, reps, lapses, state, last_review,
         text, reading, script, grp, meanings, meaning_lang, on_readings, kun_readings,
         strokes, translation`

const FROM = `
    FROM card_item
   WHERE user_id = ? AND lang = ? AND suspended = 0`

const SELECT = `SELECT ${COLS}${FROM}`

// Les nouvelles cartes sont servies en alternance entre ecritures. Sans ca, un tri global
// unique fait passer les 208 kana (ord 0-103) avant le premier kanji (ord 1000+) : ajouter
// des kanji ne donne rien a reviser pendant des jours.
const NEW_CARDS = `
  SELECT * FROM (
    SELECT ${COLS},
           ROW_NUMBER() OVER (PARTITION BY script ORDER BY ord, kind) AS rn
      ${FROM}\${FILTER} AND state = 0
  )
   WHERE rn <= ?
   ORDER BY rn, script
   LIMIT ?`

const ph = (n: number) => Array(n).fill('?').join(',')
const who = (h: string | undefined) => h ?? 'local'
const dayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString() }

const KINDS: Record<string, string[]> = {
  hiragana: ['reading', 'recall'],
  katakana: ['reading', 'recall'],
  kanji: ['meaning', 'reading'],
  sentence: ['meaning', 'cloze'],
  word: ['meaning', 'reading']
}

const PENDING = `
    FROM content ct
    JOIN deck_selection d
      ON d.user_id = ? AND d.lang = ct.lang AND d.script = ct.script AND d.grp = ct.grp
   WHERE ct.lang = ?
     AND NOT EXISTS (
       SELECT 1 FROM card k
        WHERE k.user_id = d.user_id AND k.item_type = ct.item_type AND k.item_id = ct.item_id
     )`

/**
 * Cree les cartes des elements sur le point d'etre servis, et rien de plus. Avant, tout
 * le contenu selectionne etait materialise d'un coup : cocher les quatre niveaux de
 * phrases ecrivait 12 000 lignes pour un an de cartes.
 */
async function materialize(db: D1Database, u: string, want: number, filter: string, args: unknown[]) {
  if (want <= 0) return

  const rows = (await db.prepare(
    `SELECT * FROM (
       SELECT ct.item_type, ct.item_id, ct.script,
              ROW_NUMBER() OVER (PARTITION BY ct.script ORDER BY ct.ord) AS rn
         ${PENDING}${filter}
     )
      WHERE rn <= ? ORDER BY rn, script LIMIT ?`
  ).bind(u, LANG, ...args, want, want).all<{ item_type: string; item_id: number; script: string }>()).results

  if (!rows.length) return

  const now = new Date()
  const due = blank(now).due.toISOString()
  const insert = db.prepare(
    `INSERT OR IGNORE INTO card (user_id, lang, item_type, item_id, kind, due, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const stmts = []
  for (const r of rows) {
    for (const kind of KINDS[r.script] ?? ['reading']) {
      stmts.push(insert.bind(u, LANG, r.item_type, r.item_id, kind, due, now.toISOString()))
    }
  }
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100))
}

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
    db.prepare(`SELECT COUNT(*) n FROM review_log l JOIN card c ON c.id=l.card_id WHERE c.user_id=? AND l.reviewed_at>=?`).bind(u, day),
    db.prepare(`SELECT COUNT(*) n FROM card WHERE user_id=? AND lang=? AND suspended=0 AND lapses>=?`).bind(u, LANG, LEECH),
    db.prepare(`SELECT COUNT(*) n FROM card WHERE user_id=? AND lang=? AND suspended=1`).bind(u, LANG),
    db.prepare(`SELECT COUNT(*) n ${PENDING}`).bind(u, LANG)
  ])
  const n = (i: number) => res[i].results[0]?.n ?? 0

  const deck = await db.prepare(
    `SELECT script, kind, COUNT(*) AS n,
            SUM(CASE WHEN state <> 0 AND due <= ? THEN 1 ELSE 0 END) AS due,
            SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) AS fresh
       FROM card_item
      WHERE user_id = ? AND lang = ? AND suspended = 0
      GROUP BY script, kind`
  ).bind(now, u, LANG).all<Counts['deck'][number]>()

  const pending = await db.prepare(
    `SELECT ct.script AS script, COUNT(*) AS n ${PENDING} GROUP BY ct.script`
  ).bind(u, LANG).all<{ script: string; n: number }>()

  const waiting = new Map<string, number>()
  for (const r of pending.results) waiting.set(r.script, r.n)

  return {
    deck: deck.results,
    pending: [...waiting].map(([script, n]) => ({ script: script as Script, n })),
    cards: n(0),
    dueNow: n(1),
    newAvailable: n(2) + n(8) * 2,
    newPerDay: cap,
    newLeftToday: Math.max(0, cap - n(3)),
    learned: n(4),
    reviewsToday: n(5),
    hard: n(6),
    suspended: n(7)
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

interface Pools {
  kana: Kana[]
  senses: string[]
  glosses: string[]
  words: Map<number, string[]>
  surfaces: string[]
}

const HAS_KANJI = /[一-龯]/

// Le mot masque est fixe par l'identifiant de carte : la meme carte pose toujours la
// meme question. On evite les particules d'un seul kana, qui se devinent sans rien savoir.
function blankIndex(cardId: number, words: string[]): number {
  const all = words.map((_, i) => i)
  const good = all.filter(i => HAS_KANJI.test(words[i]) || words[i].length >= 2)
  const pool = good.length ? good : all
  return pool[cardId % pool.length]
}

// Deux cartes d'un meme element ne doivent pas se suivre : le texte a trous devoile la
// traduction que la carte de comprehension va demander, et le sens d'un kanji donne sa
// lecture. On decale la suivante des qu'une repetition apparait.
function spread(rows: Row[]): Row[] {
  const out: Row[] = []
  const rest = [...rows]
  while (rest.length) {
    const last = out[out.length - 1]
    const k = last ? rest.findIndex(r => r.item_id !== last.item_id) : 0
    out.push(rest.splice(k < 0 ? 0 : k, 1)[0])
  }
  return out
}

function toCard(row: Row, p: Pools, now: Date): QueueCard {
  const meanings = list(row.meanings)
  const words = p.words.get(row.item_id) ?? []
  const choices: string[] = []
  let blank = -1

  if (row.kind === 'recall') {
    const others = p.kana.filter(k => k.kind === row.script && k.reading !== row.reading)
    choices.push(row.text, ...pick(others, 3, k => k.glyph === row.text).map(k => k.glyph))
  } else if (row.kind === 'meaning' && meanings.length) {
    const pool = row.script === 'word' ? p.glosses : p.senses
    choices.push(meanings[0], ...pick(pool, 3, v => meanings.includes(v)))
  } else if (row.kind === 'cloze' && words.length) {
    blank = blankIndex(row.id, words)
    const answer = words[blank]
    choices.push(answer, ...pick(p.surfaces, 3, v => v === answer || words.includes(v)))
  }
  if (choices.length) choices.sort(() => Math.random() - 0.5)

  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
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
    strokes: row.strokes,
    translation: row.translation ?? '',
    words,
    blank,
    lapses: row.lapses
  }
}

// Viviers de leurres et mots des phrases, charges seulement si la file en a besoin
async function buildPools(db: D1Database, rows: Row[]): Promise<Pools> {
  const kana = rows.some(r => r.kind === 'recall')
    ? (await db.prepare(
        `SELECT glyph, reading, kind FROM character WHERE lang=? AND kind<>'kanji' AND grp<>'rare'`
      ).bind(LANG).all<Kana>()).results
    : []

  const glosses = rows.some(r => r.kind === 'meaning' && r.script === 'word')
    ? (await db.prepare(
        `SELECT gloss FROM word WHERE lang=? AND gloss <> '' ORDER BY RANDOM() LIMIT 60`
      ).bind(LANG).all<{ gloss: string }>()).results.map(r => r.gloss)
    : []

  const senses = rows.some(r => r.kind === 'meaning' && r.script === 'kanji')
    ? (await db.prepare(
        `SELECT json_extract(meanings, '$[0]') AS m FROM character
          WHERE lang=? AND kind='kanji' AND meanings IS NOT NULL ORDER BY RANDOM() LIMIT 80`
      ).bind(LANG).all<{ m: string }>()).results.map(r => r.m).filter(Boolean)
    : []

  const ids = [...new Set(rows.filter(r => r.script === 'sentence').map(r => r.item_id))]
  const words = new Map<number, string[]>()
  let surfaces: string[] = []

  if (ids.length) {
    const res = await db.prepare(
      `SELECT sentence_id, surface FROM sentence_word
        WHERE sentence_id IN (${ph(ids.length)}) ORDER BY sentence_id, pos`
    ).bind(...ids).all<{ sentence_id: number; surface: string }>()
    for (const r of res.results) {
      const acc = words.get(r.sentence_id) ?? []
      acc.push(r.surface)
      words.set(r.sentence_id, acc)
    }
    surfaces = (await db.prepare(
      `SELECT DISTINCT surface FROM sentence_word ORDER BY RANDOM() LIMIT 150`
    ).all<{ surface: string }>()).results.map(r => r.surface)
  }

  return { kana, senses, glosses, words, surfaces }
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
  const now = new Date().toISOString()

  // On enregistre ce qui est choisi, pas les cartes : elles naitront a l'introduction.
  const insert = c.env.DB.prepare(
    `INSERT OR IGNORE INTO deck_selection (user_id, lang, script, grp, added_at) VALUES (?, ?, ?, ?, ?)`
  )
  const stmts = []
  for (const script of scripts) {
    for (const grp of groups) {
      const fits = script === 'sentence' ? grp.startsWith('level') : !grp.startsWith('level')
      if (fits) stmts.push(insert.bind(u, LANG, script, grp, now))
    }
  }
  if (stmts.length) await c.env.DB.batch(stmts)

  return c.json(await counts(c.env.DB, u))
})

// Filtre commun a la file de revision et a l'entrainement : on ne melange pas
// caracteres et phrases dans une meme seance sauf demande explicite.
function selection(q: (k: string) => string | undefined) {
  const csv = (v: string | undefined) => (v ? v.split(',').filter(Boolean) : [])
  const scripts = csv(q('scripts'))
  const groups = csv(q('groups'))
  const kinds = csv(q('kinds'))
  const clauses: string[] = []
  const args: unknown[] = []
  if (scripts.length) { clauses.push(`script IN (${ph(scripts.length)})`); args.push(...scripts) }
  if (groups.length) { clauses.push(`grp IN (${ph(groups.length)})`); args.push(...groups) }
  if (kinds.length) { clauses.push(`kind IN (${ph(kinds.length)})`); args.push(...kinds) }
  return { sql: clauses.length ? ' AND ' + clauses.join(' AND ') : '', args }
}

api.get('/queue', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const limit = Math.min(60, Number(c.req.query('limit') ?? 20))
  const now = new Date()
  const ct = await counts(c.env.DB, u)
  const f = selection(k => c.req.query(k))

  const reviews = await c.env.DB.prepare(
    `${SELECT}${f.sql} AND state<>0 AND due<=? ORDER BY due LIMIT ?`
  ).bind(u, LANG, ...f.args, now.toISOString(), limit).all<Row>()

  const room = Math.min(ct.newLeftToday, Math.max(0, limit - reviews.results.length))
  if (room > 0) await materialize(c.env.DB, u, Math.ceil(room / 2), f.sql.replace(/script/g, 'ct.script'), f.args)

  const fresh = room > 0
    ? (await c.env.DB.prepare(
        NEW_CARDS.replace('${FILTER}', f.sql)
      ).bind(u, LANG, ...f.args, room, room).all<Row>()).results
    : []

  const queue = spread(interleave(reviews.results, fresh))
  const p = await buildPools(c.env.DB, queue)

  return c.json({
    cards: queue.map(r => toCard(r, p, now)),
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

  return c.json({
    due: card.due.toISOString(),
    interval: label(card.due, now),
    previews: previews(card, now)
  })
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
  const f = selection(k => c.req.query(k))

  const rows = spread((await c.env.DB.prepare(`${SELECT}${f.sql} ORDER BY RANDOM() LIMIT ?`)
    .bind(u, LANG, ...f.args, limit).all<Row>()).results)

  const p = await buildPools(c.env.DB, rows)

  return c.json({ cards: rows.map(r => toCard(r, p, now)), counts: await counts(c.env.DB, u) })
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

api.get('/stats', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const now = new Date()
  const since = new Date(now.getTime() - 13 * 86400000).toISOString().slice(0, 10)
  const until = new Date(now.getTime() + 14 * 86400000).toISOString()

  const res = await c.env.DB.batch([
    // etat 0 = neuve, 2 = acquise, 1 et 3 = en cours d'apprentissage
    c.env.DB.prepare(
      `SELECT state, COUNT(*) AS n FROM card
        WHERE user_id=? AND lang=? AND suspended=0 GROUP BY state`
    ).bind(u, LANG),
    c.env.DB.prepare(
      `SELECT date(l.reviewed_at) AS day, COUNT(*) AS n, SUM(COALESCE(l.correct,0)) AS ok
         FROM review_log l JOIN card c ON c.id = l.card_id
        WHERE c.user_id=? AND l.mode='review' AND date(l.reviewed_at) >= ?
        GROUP BY day ORDER BY day`
    ).bind(u, since),
    c.env.DB.prepare(
      `SELECT date(due) AS day, COUNT(*) AS n FROM card
        WHERE user_id=? AND lang=? AND suspended=0 AND state<>0 AND due < ?
        GROUP BY day ORDER BY day`
    ).bind(u, LANG, until),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n, SUM(COALESCE(l.correct,0)) AS ok
         FROM review_log l JOIN card c ON c.id = l.card_id
        WHERE c.user_id=? AND l.mode='review' AND l.correct IS NOT NULL`
    ).bind(u),
    c.env.DB.prepare(
      `SELECT DISTINCT date(l.reviewed_at) AS day
         FROM review_log l JOIN card c ON c.id = l.card_id
        WHERE c.user_id=? ORDER BY day DESC LIMIT 400`
    ).bind(u)
  ])

  const states = new Map<number, number>()
  for (const r of res[0].results as { state: number; n: number }[]) states.set(r.state, r.n)

  const total = res[3].results[0] as { n: number; ok: number } | undefined

  // serie en cours : on tolere que la journee d'aujourd'hui ne soit pas encore entamee
  const days = (res[4].results as { day: string }[]).map(r => r.day)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  let streak = 0
  const cursor = new Date(now)
  if (days[0] && days[0] !== iso(cursor)) cursor.setDate(cursor.getDate() - 1)
  for (const d of days) {
    if (d !== iso(cursor)) break
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  return c.json({
    fresh: states.get(0) ?? 0,
    learning: (states.get(1) ?? 0) + (states.get(3) ?? 0),
    known: states.get(2) ?? 0,
    answered: total?.n ?? 0,
    right: total?.ok ?? 0,
    streak,
    past: res[1].results,
    ahead: res[2].results
  })
})

// --- le parcours guide ---

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

api.get('/course', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))

  const res = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT id, pos, title, summary, unlocks FROM milestone WHERE lang=? ORDER BY pos`).bind(LANG),
    c.env.DB.prepare(`SELECT id, milestone_id, pos, title FROM lesson ORDER BY milestone_id, pos`),
    c.env.DB.prepare(LESSON_COVER).bind(u),
    c.env.DB.prepare(`SELECT lesson_id, state FROM lesson_progress WHERE user_id=?`).bind(u)
  ])

  const cover = new Map<number, { items: number; owned: number; known: number }>()
  for (const r of res[2].results as { lesson_id: number; items: number; owned: number; known: number }[]) {
    cover.set(r.lesson_id, { items: r.items, owned: r.owned, known: r.known })
  }
  const done = new Map<number, string>()
  for (const r of res[3].results as { lesson_id: number; state: string }[]) done.set(r.lesson_id, r.state)

  const lessons = res[1].results as { id: number; milestone_id: number; pos: number; title: string }[]

  return c.json((res[0].results as { id: number; pos: number; title: string; summary: string; unlocks: string }[])
    .map(m => ({
      id: m.id,
      pos: m.pos,
      title: m.title,
      summary: m.summary,
      unlocks: m.unlocks,
      lessons: lessons.filter(l => l.milestone_id === m.id).map(l => ({
        id: l.id,
        pos: l.pos,
        title: l.title,
        state: done.get(l.id) ?? null,
        ...(cover.get(l.id) ?? { items: 0, owned: 0, known: 0 })
      }))
    })))
})

api.get('/lesson/:id', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const id = Number(c.req.param('id'))

  const lesson = await c.env.DB.prepare(
    `SELECT l.id, l.title, l.body, m.title AS chapter FROM lesson l
       JOIN milestone m ON m.id = l.milestone_id WHERE l.id = ?`
  ).bind(id).first<{ id: number; title: string; body: string; chapter: string }>()
  if (!lesson) return c.json({ error: 'leçon introuvable' }, 404)

  const items = await c.env.DB.prepare(
    `SELECT li.role, li.item_type, li.item_id, li.pos,
            COALESCE(w.lemma, s.text) AS text,
            COALESCE(w.reading, '') AS reading,
            COALESCE(w.gloss, s.translation) AS gloss,
            EXISTS (SELECT 1 FROM card c
                     WHERE c.user_id = ? AND c.item_type = li.item_type AND c.item_id = li.item_id) AS owned
       FROM lesson_item li
       LEFT JOIN word w ON li.item_type = 'word' AND w.id = li.item_id
       LEFT JOIN sentence s ON li.item_type = 'sentence' AND s.id = li.item_id
      WHERE li.lesson_id = ?
      ORDER BY li.role DESC, li.pos`
  ).bind(u, id).all<{
    role: string; item_type: string; item_id: number; pos: number
    text: string; reading: string; gloss: string; owned: number
  }>()

  const progress = await c.env.DB.prepare(
    `SELECT state FROM lesson_progress WHERE user_id=? AND lesson_id=?`
  ).bind(u, id).first<{ state: string }>()

  return c.json({
    ...lesson,
    state: progress?.state ?? null,
    items: items.results.map(r => ({
      role: r.role,
      type: r.item_type,
      id: r.item_id,
      text: r.text,
      reading: r.reading,
      gloss: r.gloss,
      owned: r.owned === 1
    }))
  })
})

// Rien n'est ajoute d'office : le client envoie exactement ce que l'utilisateur a coche.
api.post('/lesson/:id/complete', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const id = Number(c.req.param('id'))
  const b = await c.req.json<{ words?: number[]; sentences?: number[]; state?: string }>()
  const now = new Date()
  const due = blank(now).due.toISOString()
  const state = b.state === 'known' ? 'known' : 'done'

  const insert = c.env.DB.prepare(
    `INSERT OR IGNORE INTO card (user_id, lang, item_type, item_id, kind, due, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const stmts = []
  for (const w of b.words ?? []) {
    for (const kind of ['meaning', 'reading']) {
      stmts.push(insert.bind(u, LANG, 'word', w, kind, due, now.toISOString()))
    }
  }
  for (const s of b.sentences ?? []) {
    for (const kind of ['meaning', 'cloze']) {
      stmts.push(insert.bind(u, LANG, 'sentence', s, kind, due, now.toISOString()))
    }
  }
  stmts.push(
    c.env.DB.prepare(
      `INSERT INTO lesson_progress (user_id, lesson_id, state, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, lesson_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`
    ).bind(u, id, state, now.toISOString())
  )

  for (let i = 0; i < stmts.length; i += 100) await c.env.DB.batch(stmts.slice(i, i + 100))
  return c.json(await counts(c.env.DB, u))
})

// --- cartes a probleme : ratees en boucle, ou mises de cote ---

api.get('/cards/hard', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))

  const rows = (await c.env.DB.prepare(
    `SELECT id, kind, script, text, translation, lapses, reps, suspended, due
       FROM card_item
      WHERE user_id = ? AND lang = ? AND (lapses >= ? OR suspended = 1)
      ORDER BY suspended, lapses DESC, reps DESC
      LIMIT 80`
  ).bind(u, LANG, LEECH).all<{
    id: number; kind: CardKind; script: Script; text: string; translation: string | null
    lapses: number; reps: number; suspended: number; due: string
  }>()).results

  const stats = new Map<number, { n: number; ok: number }>()
  if (rows.length) {
    const ids = rows.map(r => r.id)
    const res = await c.env.DB.prepare(
      `SELECT card_id, COUNT(*) AS n, SUM(COALESCE(correct, 0)) AS ok
         FROM review_log
        WHERE mode = 'review' AND card_id IN (${ph(ids.length)})
        GROUP BY card_id`
    ).bind(...ids).all<{ card_id: number; n: number; ok: number }>()
    for (const r of res.results) stats.set(r.card_id, { n: r.n, ok: r.ok })
  }

  return c.json(rows.map(r => ({
    id: r.id,
    kind: r.kind,
    script: r.script,
    text: r.text,
    translation: r.translation ?? '',
    lapses: r.lapses,
    reps: r.reps,
    suspended: r.suspended === 1,
    due: r.due,
    answered: stats.get(r.id)?.n ?? 0,
    right: stats.get(r.id)?.ok ?? 0
  })))
})

api.get('/cards/:id/history', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const id = Number(c.req.param('id'))

  const own = await c.env.DB.prepare(`SELECT 1 AS ok FROM card WHERE id=? AND user_id=?`)
    .bind(id, u).first<{ ok: number }>()
  if (!own) return c.json({ error: 'carte introuvable' }, 404)

  const rows = await c.env.DB.prepare(
    `SELECT reviewed_at, rating, correct, answer, scheduled_days, mode
       FROM review_log WHERE card_id = ? ORDER BY reviewed_at DESC LIMIT 30`
  ).bind(id).all<{
    reviewed_at: string; rating: number; correct: number | null
    answer: string | null; scheduled_days: number; mode: string
  }>()

  return c.json(rows.results.map(r => ({
    reviewedAt: r.reviewed_at,
    rating: r.rating,
    correct: r.correct === null ? null : r.correct === 1,
    answer: r.answer,
    scheduledDays: r.scheduled_days,
    mode: r.mode
  })))
})

api.post('/cards/:id/action', async c => {
  const u = who(c.req.header('Cf-Access-Authenticated-User-Email'))
  const id = Number(c.req.param('id'))
  const { action } = await c.req.json<{ action: CardAction }>()
  const now = new Date().toISOString()

  if (action === 'suspend' || action === 'unsuspend') {
    await c.env.DB.prepare(`UPDATE card SET suspended = ? WHERE id = ? AND user_id = ?`)
      .bind(action === 'suspend' ? 1 : 0, id, u).run()
  } else if (action === 'reset') {
    // On efface la planification mais on garde l'historique : c'est lui qui dit que
    // la carte a deja pose probleme.
    await c.env.DB.prepare(
      `UPDATE card SET state = 0, stability = 0, difficulty = 0, elapsed_days = 0,
              scheduled_days = 0, learning_steps = 0, reps = 0, lapses = 0,
              last_review = NULL, introduced_at = NULL, suspended = 0, due = ?
        WHERE id = ? AND user_id = ?`
    ).bind(now, id, u).run()
  } else {
    return c.json({ error: 'action inconnue' }, 400)
  }

  return c.json(await counts(c.env.DB, u))
})

const app = new Hono<Env>()
app.route('/api', api)
app.all('*', async c => {
  const res = await c.env.ASSETS.fetch(c.req.raw)
  if (res.status !== 404) return res
  return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url), c.req.raw))
})

export default app
