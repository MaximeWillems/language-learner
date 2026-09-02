import type { Counts, PracticeRequest, Script } from '../shared/types'

const TRACKS: { key: string; label: string; action: string; scripts: Script[] }[] = [
  { key: 'chars', label: 'Caractères', action: 'Réviser les caractères', scripts: ['hiragana', 'katakana', 'kanji'] },
  { key: 'words', label: 'Mots', action: 'Réviser les mots', scripts: ['word'] },
  { key: 'sentences', label: 'Phrases', action: 'Réviser les phrases', scripts: ['sentence'] }
]

export default function Home({ counts, onStart }: {
  counts: Counts | null
  onStart: (filters: PracticeRequest) => void
}) {
  const deck = counts?.deck ?? []

  if (counts && deck.length === 0) {
    return (
      <section className="panel">
        <h2>Rien dans ton paquet</h2>
        <p className="hint">
          Commence par le <strong>Parcours</strong> si tu débutes, ou charge directement
          des caractères et des phrases depuis leurs onglets.
        </p>
      </section>
    )
  }

  return (
    <>
      <section className="tracks">
        {TRACKS.map(t => {
          const slice = deck.filter(d => t.scripts.includes(d.script))
          const owned = slice.reduce((a, d) => a + d.n, 0)
          // deux cartes par element encore a introduire
          const waiting = (counts?.pending ?? [])
            .filter(p => t.scripts.includes(p.script))
            .reduce((a, p) => a + p.n, 0) * 2
          if (!owned && !waiting) return null
          const due = slice.reduce((a, d) => a + d.due, 0)
          const ready = slice.reduce((a, d) => a + d.fresh, 0) + waiting
          const fresh = counts ? Math.min(ready, counts.newLeftToday) : 0
          const total = due + fresh
          return (
            <div className="session" key={t.key}>
              <span className="who">{t.label}</span>
              <span className="n">{total}</span>
              <span className="l">
                {total === 0 ? 'rien à réviser' : `${due} en révision · ${fresh} nouvelle${fresh > 1 ? 's' : ''}`}
              </span>
              <button
                className="primary"
                disabled={total === 0}
                onClick={() => onStart({ scripts: t.scripts, groups: [], kinds: [] })}
              >
                {total === 0 ? 'À jour' : t.action}
              </button>
            </div>
          )
        })}
      </section>

      {counts && (
        <section className="track">
          <div><span className="n">{counts.learned}</span><span className="l">apprises</span></div>
          <div><span className="n">{counts.reviewsToday}</span><span className="l">révisions aujourd’hui</span></div>
          <div><span className="n">{counts.cards}</span><span className="l">cartes au total</span></div>
        </section>
      )}
    </>
  )
}
