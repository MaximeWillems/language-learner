import { toHiragana } from 'wanakana'

const romaji = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '')

/**
 * Compare une saisie a un kana attendu en passant par une forme unique.
 * Absorbe Hepburn/kunrei (shi = si, tsu = tu, fu = hu), la casse, les espaces,
 * la saisie directe en kana et la difference hiragana / katakana.
 */
export function matchesKana(input: string, glyph: string, reading: string): boolean {
  const typed = romaji(input)
  if (!typed) return false
  if (toHiragana(typed, { passRomaji: false }) === toHiragana(glyph)) return true
  if (typed === reading) return true
  return reading === 'n' && (typed === 'nn' || typed === "n'")
}

/**
 * Formes acceptees pour une lecture KANJIDIC. Le point separe ce que couvre le kanji
 * de l'okurigana ecrit en kana : "おこな.う" vaut おこな (strict) ou おこなう (comme on le dit).
 * Le tiret marque un prefixe ou un suffixe et ne se prononce pas.
 */
const forms = (r: string): string[] => {
  const clean = r.replace(/^-+|-+$/g, '')
  const strict = clean.split('.')[0]
  const full = clean.replace(/\./g, '')
  return strict === full ? [strict] : [strict, full]
}

/** Un kanji a plusieurs lectures valables : on accepte n'importe laquelle. */
export function matchesAnyReading(input: string, readings: string[]): boolean {
  const typed = toHiragana(romaji(input), { passRomaji: false })
  if (!typed) return false
  return readings.some(r => forms(r).some(f => f.length > 0 && toHiragana(f) === typed))
}
