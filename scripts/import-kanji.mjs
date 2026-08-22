// Extrait les kanji joyo de KANJIDIC2 et produit migrations/0004_seed_kanji.sql
//
//   node scripts/import-kanji.mjs chemin/vers/kanjidic2.xml
//
// KANJIDIC2 : Electronic Dictionary Research and Development Group, licence CC BY-SA.
// Le XML n'est pas versionne (15 Mo) — seul le SQL genere l'est.

import { readFileSync, writeFileSync } from 'node:fs'

const source = process.argv[2]
if (!source) {
  console.error('usage: node scripts/import-kanji.mjs <kanjidic2.xml>')
  process.exit(1)
}

const xml = readFileSync(source, 'utf8')
const blocks = xml.split('<character>').slice(1)

const one = (block, re) => { const m = block.match(re); return m ? m[1] : null }
const many = (block, re) => [...block.matchAll(re)].map(m => m[1])

const GRADES = { 1: 'grade1', 2: 'grade2', 3: 'grade3', 4: 'grade4', 5: 'grade5', 6: 'grade6', 8: 'college' }

const kanji = []

for (const block of blocks) {
  const glyph = one(block, /<literal>(.*?)<\/literal>/)
  const grade = Number(one(block, /<grade>(\d+)<\/grade>/) ?? 0)
  if (!glyph || !GRADES[grade]) continue

  const fr = many(block, /<meaning m_lang="fr">(.*?)<\/meaning>/g)
  const en = many(block, /<meaning>(.*?)<\/meaning>/g)
  const meanings = fr.length ? fr : en
  if (!meanings.length) continue

  const on = many(block, /<reading r_type="ja_on">(.*?)<\/reading>/g)
  const kun = many(block, /<reading r_type="ja_kun">(.*?)<\/reading>/g)
  if (!on.length && !kun.length) continue

  kanji.push({
    glyph,
    grade,
    grp: GRADES[grade],
    meanings: meanings.slice(0, 5),
    meaningLang: fr.length ? 'fr' : 'en',
    on,
    kun,
    strokes: Number(one(block, /<stroke_count>(\d+)<\/stroke_count>/) ?? 0) || null,
    freq: Number(one(block, /<freq>(\d+)<\/freq>/) ?? 0) || null,
    jlpt: Number(one(block, /<jlpt>(\d+)<\/jlpt>/) ?? 0) || null
  })
}

// les plus courants d'abord, a l'interieur de chaque niveau
kanji.sort((a, b) => a.grade - b.grade || (a.freq ?? 9999) - (b.freq ?? 9999) || a.glyph.localeCompare(b.glyph))

const decode = s => s
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&')

const q = v => v === null ? 'NULL' : `'${decode(String(v)).replace(/'/g, "''")}'`
const json = arr => q(JSON.stringify(arr.map(decode)))

// lecture principale : le premier kun sans okurigana, sinon le premier on
const primary = k => {
  const base = r => r.replace(/^-|-$/g, '').split('.')[0]
  return base(k.kun[0] ?? k.on[0])
}

const rows = kanji.map((k, i) =>
  `('ja',${q(k.glyph)},'kanji',${q(primary(k))},${q(k.grp)},${1000 + i},` +
  `${json(k.meanings)},${q(k.meaningLang)},${json(k.on)},${json(k.kun)},` +
  `${k.grade},${k.strokes ?? 'NULL'},${k.freq ?? 'NULL'},${k.jlpt ?? 'NULL'})`
)

// D1 borne la taille d'une requete : on decoupe plutot qu'un INSERT de 300 Ko
const CHUNK = 200
const COLS = '(lang, glyph, kind, reading, grp, ord, meanings, meaning_lang, on_readings, kun_readings, grade, strokes, freq, jlpt)'
const parts = []
for (let i = 0; i < rows.length; i += CHUNK) {
  parts.push('INSERT INTO character\n  ' + COLS + '\nVALUES\n  ' + rows.slice(i, i + CHUNK).join(',\n  ') + ';')
}

const header = [
  '-- Genere par scripts/import-kanji.mjs depuis KANJIDIC2 - ne pas editer a la main',
  '-- KANJIDIC2 (c) Electronic Dictionary Research and Development Group, CC BY-SA',
  ''
].join('\n')

writeFileSync(new URL('../migrations/0004_seed_kanji.sql', import.meta.url), header + parts.join('\n\n') + '\n', 'utf8')

const fr = kanji.filter(k => k.meaningLang === 'fr').length
console.log(`${kanji.length} kanji ecrits en ${parts.length} instructions (${fr} en francais, ${kanji.length - fr} en anglais)`)
for (const g of Object.values(GRADES)) {
  console.log(`  ${g.padEnd(8)} ${kanji.filter(k => k.grp === g).length}`)
}
