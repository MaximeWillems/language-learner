import { toHiragana, toRomaji } from 'wanakana'

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

/**
 * Transcription d'une lecture en romaji. Les lectures on s'ecrivent en katakana par
 * convention, ce qui ne dit rien a qui ne les lit pas encore couramment : サン ne se
 * prononce pas tout seul. Le point d'okurigana et le tiret de prefixe sont conserves,
 * ils portent une information.
 */
export const romajiOf = (kana: string): string => (kana ? toRomaji(kana) : '')
