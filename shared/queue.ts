/**
 * Ordonnancement d'une file de revision. Fonctions pures, sans base ni framework :
 * c'est la partie ou les erreurs sont couteuses et invisibles, donc celle qui se teste.
 */

/** Un element de file, reduit a ce dont l'ordonnancement a besoin. */
export interface Orderable {
  item_id: number
  script: string
}

export const HAS_KANJI = /[一-龯]/

/**
 * Tire n valeurs distinctes au hasard, en ignorant celles que `skip` rejette.
 *
 * Melange partiel plutot que tirage avec rejet : ce dernier pouvait rendre moins de
 * valeurs que demande quand le vivier etait petit ou tres filtre, et donc afficher un
 * QCM a trois choix au lieu de quatre, de facon intermittente.
 */
export function pick<T>(from: T[], n: number, skip: (v: T) => boolean): T[] {
  const eligible = [...new Set(from)].filter(v => !skip(v))
  const take = Math.min(n, eligible.length)
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (eligible.length - i))
    const tmp = eligible[i]
    eligible[i] = eligible[j]
    eligible[j] = tmp
  }
  return eligible.slice(0, take)
}

/**
 * Glisse une nouveaute toutes les quatre revisions. Un bloc de nouveautes en fin de
 * seance serait subi d'un coup, alors qu'intercalees elles passent inapercues.
 */
export function interleave<T>(due: T[], fresh: T[]): T[] {
  const out: T[] = []
  let d = 0
  let f = 0
  while (d < due.length || f < fresh.length) {
    for (let i = 0; i < 4 && d < due.length; i++) out.push(due[d++])
    if (f < fresh.length) out.push(fresh[f++])
  }
  return out
}

/**
 * Ecarte les cartes d'un meme element. Le texte a trous devoile la traduction que la
 * carte de comprehension va demander juste apres, et le sens d'un kanji donne sa lecture :
 * les laisser se suivre offre la reponse.
 */
export function spread<T extends Orderable>(rows: T[]): T[] {
  const out: T[] = []
  const rest = [...rows]
  while (rest.length) {
    const last = out[out.length - 1]
    const k = last ? rest.findIndex(r => r.item_id !== last.item_id) : 0
    out.push(rest.splice(k < 0 ? 0 : k, 1)[0])
  }
  return out
}

/**
 * Choisit le mot a masquer dans une phrase. Determine par l'identifiant de carte, donc
 * stable : la meme carte pose toujours la meme question. On evite les particules d'un
 * seul kana, qui se devinent sans rien savoir de la phrase.
 */
export function blankIndex(cardId: number, words: string[]): number {
  const all = words.map((_, i) => i)
  const good = all.filter(i => HAS_KANJI.test(words[i]) || words[i].length >= 2)
  const pool = good.length ? good : all
  return pool.length ? pool[cardId % pool.length] : 0
}
