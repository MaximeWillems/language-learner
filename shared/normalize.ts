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
