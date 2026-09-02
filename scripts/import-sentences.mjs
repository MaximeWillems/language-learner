// Construit migrations/0007_seed_sentences.sql a partir de Tatoeba et du corpus Tanaka.
//
//   node scripts/import-sentences.mjs <dossier des corpus>
//
// Attend dans ce dossier : jpn_sentences.tsv, fra_sentences.tsv, jpn-fra_links.tsv
// (https://downloads.tatoeba.org/exports/) et examples.utf
// (http://ftp.edrdg.org/pub/Nihongo/examples.utf.gz).
//
// Tatoeba : CC BY 2.0 FR. Corpus Tanaka : Electronic Dictionary Research and
// Development Group, CC BY-SA. Les fichiers sources ne sont pas versionnes.
//
// Tanaka donne le decoupage en mots fait a la main, ce qui evite un analyseur
// morphologique : son dictionnaire pese 15 Mo et ne tient pas dans un navigateur.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('usage: node scripts/import-sentences.mjs <dossier des corpus>')
  process.exit(1)
}

const MAX_SENTENCES = 6000
const lines = f => readFileSync(join(dir, f), 'utf8').split('\n')

// --- niveaux scolaires des kanji, relus depuis la migration deja generee ---
const grades = new Map()
const kanjiSql = readFileSync(new URL('../migrations/0004_seed_kanji.sql', import.meta.url), 'utf8')
for (const m of kanjiSql.matchAll(/\('ja','(.)','kanji','[^']*','(grade\d|college)'/g)) {
  grades.set(m[1], m[2] === 'college' ? 8 : Number(m[2].slice(5)))
}

// --- phrases et liens Tatoeba ---
const jpn = new Map()
for (const l of lines('jpn_sentences.tsv')) {
  const p = l.split('\t')
  if (p.length >= 3) jpn.set(p[0], p[2])
}

const fra = new Map()
for (const l of lines('fra_sentences.tsv')) {
  const p = l.split('\t')
  if (p.length >= 3) fra.set(p[0], p[2])
}

const translation = new Map()
for (const l of lines('jpn-fra_links.tsv')) {
  const [a, b] = l.split('\t')
  if (jpn.has(a) && fra.has(b) && !translation.has(a)) translation.set(a, fra.get(b))
}

// --- decoupage en mots du corpus Tanaka, indexe par texte japonais ---
const TOKEN = /^([^(\[{~]+)(?:\(([^)]*)\))?(?:\[(\d+)\])?(?:\{([^}]*)\})?~?$/
const segments = new Map()
let head = null
for (const l of lines('examples.utf')) {
  if (l.startsWith('A: ')) {
    head = l.slice(3).split('#ID=')[0].split('\t')[0].trim()
  } else if (l.startsWith('B: ') && head) {
    const words = []
    for (const tok of l.slice(3).trim().split(/\s+/)) {
      const m = TOKEN.exec(tok)
      if (!m) continue
      const [, lemma, paren, , brace] = m
      const reading = paren && !paren.startsWith('#') ? paren : ''
      words.push({ lemma, reading, surface: brace || lemma })
    }
    if (words.length) segments.set(head, words)
    head = null
  }
}

// --- selection et notation de difficulte ---
const KANJI = /[一-龯]/g

// fragments de dialogue, listes de vocabulaire, phrases a rallonge : peu utiles a
// l'apprentissage et sur-representes en tete de corpus
const REJECT = /[「」『』（）()\[\]…]|^\s*[-–—]/

const candidates = []
for (const [id, text] of jpn) {
  const fr = translation.get(id)
  const words = segments.get(text)
  if (!fr || !words) continue
  if (words.length < 4 || words.length > 12) continue
  if (text.length > 42 || REJECT.test(text) || REJECT.test(fr)) continue
  candidates.push({ id, text, fr, words })
}

// Tanaka n'annote que les mots du dictionnaire : les noms propres et quelques
// tournures sont absents de la ligne B. Une phrase dont le decoupage ne couvre pas
// l'essentiel du texte est inexploitable — on ne pourrait pas en masquer un mot.
const PUNCT = /[\u3000-\u303f\uff01-\uff0f\uff1a-\uff20\s。、！？「」]/g
for (const s of candidates) {
  const bare = s.text.replace(PUNCT, '')
  const seen = s.words.map(w => w.surface).join('').replace(PUNCT, '')
  s.coverage = bare.length ? Math.min(1, seen.length / bare.length) : 0
}
const covered = candidates.filter(s => s.coverage >= 0.85)

// frequence des mots : un mot vu partout se croisera de toute facon, un mot vu une
// seule fois ne sert a rien tot dans l'apprentissage
const freq = new Map()
for (const s of covered) {
  for (const w of s.words) freq.set(w.lemma, (freq.get(w.lemma) ?? 0) + 1)
}

const KANJI2 = /[\u4e00-\u9faf]/g
for (const s of covered) {
  const ks = [...new Set(s.text.match(KANJI2) ?? [])]
  s.hardestKanji = ks.length ? Math.max(...ks.map(k => grades.get(k) ?? 9)) : 0
  s.rarity = Math.min(...s.words.map(w => freq.get(w.lemma) ?? 1))
  s.level =
    s.hardestKanji >= 9 ? 4
    : s.words.length <= 7 && s.hardestKanji <= 2 && s.rarity >= 8 ? 1
    : s.words.length <= 9 && s.hardestKanji <= 4 && s.rarity >= 4 ? 2
    : s.words.length <= 11 && s.hardestKanji <= 6 ? 3
    : 4
}

covered.sort((a, b) => a.level - b.level || b.rarity - a.rarity || a.words.length - b.words.length)

const QUOTA = { 1: 900, 2: 1800, 3: 2100, 4: 1200 }
const kept = []
const used = { 1: 0, 2: 0, 3: 0, 4: 0 }
const seenWord = new Map()

for (const s of covered) {
  if (used[s.level] >= QUOTA[s.level]) continue
  // variete : on ecarte une phrase dont tous les mots sont deja largement couverts,
  // sinon le tri par frequence produit cinquante variations de la meme tournure
  if (s.words.every(w => (seenWord.get(w.lemma) ?? 0) >= 4)) continue
  for (const w of s.words) seenWord.set(w.lemma, (seenWord.get(w.lemma) ?? 0) + 1)
  used[s.level]++
  kept.push(s)
  if (kept.length >= MAX_SENTENCES) break
}

console.log(`candidats ${candidates.length} -> couverture suffisante ${covered.length}`)

// --- table des mots, dedupliquee sur lemme + lecture ---
const words = new Map()
const key = w => w.lemma + '\u0001' + w.reading
for (const s of kept) {
  for (const w of s.words) {
    if (!words.has(key(w))) words.set(key(w), { id: words.size + 1, lemma: w.lemma, reading: w.reading })
  }
}

// --- generation SQL ---
const q = v => `'${String(v).replace(/'/g, "''")}'`
const chunk = (rows, cols, table, size = 200) => {
  const out = []
  for (let i = 0; i < rows.length; i += size) {
    out.push(`INSERT INTO ${table}\n  ${cols}\nVALUES\n  ${rows.slice(i, i + size).join(',\n  ')};`)
  }
  return out
}

const sentenceRows = kept.map((s, i) =>
  `(${i + 1},'ja',${q(s.text)},${q(s.fr)},'fr',${q('tatoeba:' + s.id)},${s.level})`
)

const wordRows = [...words.values()].map(w =>
  `(${w.id},'ja',${q(w.lemma)},${q(w.reading)},'')`
)

const linkRows = []
for (const [i, s] of kept.entries()) {
  s.words.forEach((w, pos) => {
    linkRows.push(`(${i + 1},${words.get(key(w)).id},${pos},${q(w.surface)})`)
  })
}

const parts = [
  ...chunk(sentenceRows, '(id, lang, text, translation, trans_lang, source, level)', 'sentence'),
  ...chunk(wordRows, '(id, lang, lemma, reading, gloss)', 'word'),
  ...chunk(linkRows, '(sentence_id, word_id, pos, surface)', 'sentence_word', 400)
]

// les liens mot -> kanji se calculent en SQL : les identifiants des caracteres
// existent deja et se retrouvent par le glyphe
parts.push(`INSERT INTO word_character (word_id, character_id)
SELECT w.id, c.id
  FROM word w
  JOIN character c ON c.lang = 'ja' AND c.kind = 'kanji' AND instr(w.lemma, c.glyph) > 0
 WHERE w.lang = 'ja';`)

const header = [
  '-- Genere par scripts/import-sentences.mjs - ne pas editer a la main',
  '-- Phrases et traductions : Tatoeba, CC BY 2.0 FR',
  '-- Decoupage en mots : corpus Tanaka, EDRDG, CC BY-SA',
  ''
].join('\n')

writeFileSync(new URL('../migrations/0007_seed_sentences.sql', import.meta.url), header + parts.join('\n\n') + '\n', 'utf8')

console.log(`${kept.length} phrases, ${words.size} mots, ${linkRows.length} liens`)
console.log('  par niveau :', used)
console.log(`  ${parts.length} instructions SQL`)
