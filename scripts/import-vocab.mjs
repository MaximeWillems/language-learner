// Remplit le sens et la lecture des mots, et produit migrations/0011_seed_vocab.sql
//
//   node scripts/import-vocab.mjs <dossier des corpus>
//
// Attend dans ce dossier `JMdict` (http://ftp.edrdg.org/pub/Nihongo/JMdict.gz) et
// `examples.utf`, tous deux publies par l'Electronic Dictionary Research and
// Development Group sous licence CC BY-SA. Les sources ne sont pas versionnees.
//
// Trois sources, dans cet ordre de priorite :
//   1. les 150 sens ecrits a la main (content/vocabulaire.mjs), qui couvrent 62 % des
//      occurrences et toutes les particules ;
//   2. JMdict interroge sur le couple lemme + lecture — la lecture venant du corpus
//      par vote majoritaire, ce qui evite de deviner entre 人(ひと) et 人(にん) ;
//   3. l'anglais de JMdict quand le francais manque, signale comme tel.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import initSqlJs from 'sql.js'
import { FRENCH } from '../content/vocabulaire.mjs'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node scripts/import-vocab.mjs <dossier des corpus>')
  process.exit(1)
}

const HAS_KANJI = /[一-龯]/
const TOKEN = /^([^(\[{~]+)(?:\(([^)]*)\))?/

// --- lecture canonique de chaque lemme, par vote majoritaire sur tout le corpus ---
const votes = new Map()
for (const line of readFileSync(join(dir, 'examples.utf'), 'utf8').split('\n')) {
  if (!line.startsWith('B: ')) continue
  for (const tok of line.slice(3).trim().split(/\s+/)) {
    const m = TOKEN.exec(tok)
    if (!m || !m[2] || m[2].startsWith('#')) continue
    const c = votes.get(m[1]) ?? new Map()
    c.set(m[2], (c.get(m[2]) ?? 0) + 1)
    votes.set(m[1], c)
  }
}
const canon = new Map()
for (const [lemma, c] of votes) {
  canon.set(lemma, [...c].sort((a, b) => b[1] - a[1])[0][0])
}

// --- JMdict, indexe sur le couple exact et sur les entrees en kana seul ---
const xml = readFileSync(join(dir, 'JMdict'), 'utf8')
const KEB = /<keb>(.*?)<\/keb>/g
const REB = /<reb>(.*?)<\/reb>/g
const SENSE = /<sense>([\s\S]*?)<\/sense>/g
const FRE = /<gloss xml:lang="fre">(.*?)<\/gloss>/g
const ENG = /<gloss(?: g_type="[^"]*")?>(.*?)<\/gloss>/g
const PRI = /<(?:ke|re)_pri>(?:ichi1|news1|spec1|nf0[1-9])<\/(?:ke|re)_pri>/

const byPair = new Map()
const byKana = new Map()
const byLemma = new Map()

for (const entry of xml.split('<entry>').slice(1)) {
  const fr = []
  const en = []
  for (const [, body] of [...entry.matchAll(SENSE)].slice(0, 3)) {
    fr.push(...[...body.matchAll(FRE)].map(m => m[1]))
    en.push(...[...body.matchAll(ENG)].map(m => m[1]))
  }
  if (!fr.length && !en.length) continue

  const kebs = [...entry.matchAll(KEB)].map(m => m[1])
  const rebs = [...entry.matchAll(REB)].map(m => m[1])
  const rec = { gloss: (fr.length ? fr : en).slice(0, 4), lang: fr.length ? 'fr' : 'en', pri: PRI.test(entry) }

  for (const k of kebs) {
    for (const r of rebs) if (!byPair.has(k + '|' + r)) byPair.set(k + '|' + r, { ...rec, reading: r })
    const cur = byLemma.get(k)
    if (!cur || (rec.pri && !cur.pri)) byLemma.set(k, { ...rec, reading: rebs[0] ?? '' })
  }
  if (!kebs.length) {
    for (const r of rebs) {
      const cur = byKana.get(r)
      if (!cur || (rec.pri && !cur.pri)) byKana.set(r, { ...rec, reading: r })
    }
  }
}

// --- les mots deja en base, classes par frequence dans le corpus ---
const SQL = await initSqlJs()
const db = new SQL.Database()
const migrations = ['0001_init', '0002_seed_kana', '0003_kanji_columns', '0004_seed_kanji',
  '0005_practice', '0006_card_item_view', '0007_seed_sentences', '0008_course',
  '0009_seed_course', '0010_lazy_cards']
for (const f of migrations) {
  db.run(readFileSync(new URL(`../migrations/${f}.sql`, import.meta.url), 'utf8'))
}

const st = db.prepare(`
  SELECT w.id, w.lemma, w.reading, COUNT(sw.sentence_id) AS n
    FROM word w LEFT JOIN sentence_word sw ON sw.word_id = w.id
   GROUP BY w.id ORDER BY n DESC, w.id`)
const words = []
while (st.step()) words.push(st.getAsObject())
st.free()

// --- resolution, source par source ---
const stats = { main: 0, pair: 0, kana: 0, lemma: 0, none: 0, kept: 0 }

// `word` impose l'unicite du couple lemme + lecture. Attribuer la lecture du corpus a
// une ligne qui n'en avait pas peut la faire entrer en collision avec une autre ligne
// du meme lemme. Dans ce cas on garde sa lecture d'origine, unique par construction.
const taken = new Set(words.filter(w => w.reading).map(w => w.lemma + '|' + w.reading))

const resolved = words.map((w, i) => {
  // la lecture du corpus sert toujours a chercher le sens, meme quand on renonce a la
  // stocker : c'est elle qui identifie le mot, pas la colonne
  const known = w.reading || canon.get(w.lemma) || ''
  let reading = known
  if (!w.reading && reading && taken.has(w.lemma + '|' + reading)) {
    reading = ''
    stats.kept++
  }
  if (reading) taken.add(w.lemma + '|' + reading)
  const hand = FRENCH[w.lemma + '|' + w.reading] ?? FRENCH[w.lemma + '|' + known] ?? FRENCH[w.lemma + '|']

  let gloss = null
  let lang = 'fr'
  if (hand) {
    gloss = hand
    stats.main++
  } else {
    const hit =
      (known && byPair.get(w.lemma + '|' + known)) ||
      (!HAS_KANJI.test(w.lemma) && byKana.get(w.lemma)) ||
      byLemma.get(w.lemma)
    if (hit) {
      gloss = hit.gloss.join(', ')
      lang = hit.lang
      stats[byPair.has(w.lemma + '|' + known) ? 'pair' : HAS_KANJI.test(w.lemma) ? 'lemma' : 'kana']++
    } else {
      stats.none++
    }
  }

  const rank = i + 1
  return {
    id: w.id,
    reading: reading || (HAS_KANJI.test(w.lemma) ? '' : w.lemma),
    gloss: gloss ?? '',
    lang: gloss ? lang : '',
    freq: w.n,
    ord: rank,
    grp: rank <= 150 ? 'w1' : rank <= 500 ? 'w2' : rank <= 1200 ? 'w3' : 'w4'
  }
})

// --- SQL ---
const q = v => `'${String(v).replace(/'/g, "''")}'`
const updates = resolved.map(r =>
  `UPDATE word SET reading=${q(r.reading)}, gloss=${q(r.gloss)}, gloss_lang=${q(r.lang)},` +
  ` freq=${r.freq}, ord=${r.ord}, grp=${q(r.grp)} WHERE id=${r.id};`
)

const head = `-- Genere par scripts/import-vocab.mjs — ne pas editer a la main
-- Sens et lectures : JMdict, Electronic Dictionary Research and Development Group, CC BY-SA
-- Les 150 mots les plus frequents sont traduits a la main (content/vocabulaire.mjs)

ALTER TABLE word ADD COLUMN gloss_lang TEXT;
ALTER TABLE word ADD COLUMN freq INTEGER;
ALTER TABLE word ADD COLUMN ord INTEGER;
ALTER TABLE word ADD COLUMN grp TEXT;

CREATE INDEX idx_word_ord ON word (lang, grp, ord);

`
writeFileSync(new URL('../migrations/0011_seed_vocab.sql', import.meta.url),
  head + updates.join('\n') + '\n', 'utf8')

const fr = resolved.filter(r => r.lang === 'fr').length
const none = resolved.filter(r => !r.gloss).length
console.log(`${resolved.length} mots traites`)
console.log(`  a la main        ${stats.main}`)
console.log(`  JMdict couple    ${stats.pair}`)
console.log(`  JMdict kana      ${stats.kana}`)
console.log(`  JMdict lemme     ${stats.lemma}`)
console.log(`  sans sens        ${none}`)
console.log(`  lecture laissee vide pour eviter un doublon : ${stats.kept}`)
console.log(`\nen francais : ${fr} (${Math.round(fr / resolved.length * 100)} %)`)
for (const g of ['w1', 'w2', 'w3', 'w4']) {
  const band = resolved.filter(r => r.grp === g)
  const bfr = band.filter(r => r.lang === 'fr').length
  console.log(`  ${g} : ${String(band.length).padStart(4)} mots, ${Math.round(bfr / band.length * 100)} % en francais`)
}
