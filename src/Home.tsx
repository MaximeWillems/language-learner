import type { Counts, PracticeRequest, Script } from '../shared/types'

const TRACKS: { key: string; label: string; action: string; scripts: Script[] }[] = [
  { key: 'chars', label: 'Caractères', action: 'Réviser les caractères', scripts: ['hiragana', 'katakana', 'kanji'] },
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
          Choisis ce que tu veux apprendre dans l’onglet <strong>Caractères</strong> ou
          <strong> Phrases</strong>, puis reviens ici.
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
          if (!owned) return null
          const due = slice.reduce((a, d) => a + d.due, 0)
          const fresh = counts ? Math.min(slice.reduce((a, d) => a + d.fresh, 0), counts.newLeftToday) : 0
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
