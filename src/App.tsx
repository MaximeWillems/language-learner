import { useEffect, useState } from 'react'
import type { Counts, Script } from '../shared/types'
import { buildDeck, getCounts } from './api'
import Review from './Review'

const GROUPS = [
  { key: 'gojuon', label: 'Gojūon', hint: 'les 46 kana de base' },
  { key: 'dakuten', label: 'Dakuten', hint: 'が ざ だ ば ぱ' },
  { key: 'yoon', label: 'Yōon', hint: 'きゃ しゅ ちょ' }
]

const SCRIPTS: { key: Script; label: string; sample: string }[] = [
  { key: 'hiragana', label: 'Hiragana', sample: 'あいう' },
  { key: 'katakana', label: 'Katakana', sample: 'アイウ' }
]

export default function App() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [screen, setScreen] = useState<'home' | 'review'>('home')
  const [scripts, setScripts] = useState<Script[]>(['hiragana'])
  const [groups, setGroups] = useState<string[]>(['gojuon'])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => getCounts().then(setCounts).catch(e => setError(String(e)))

  useEffect(() => { refresh() }, [])

  const create = async () => {
    setBusy(true)
    setError(null)
    try {
      setCounts(await buildDeck({ scripts, groups }))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  if (screen === 'review') {
    return <Review onDone={() => { setScreen('home'); refresh() }} />
  }

  const pending = counts ? counts.dueNow + Math.min(counts.newAvailable, counts.newLeftToday) : 0

  return (
    <main className="page">
      <header className="head">
        <span className="jp brand">言葉</span>
        <h1>Kotoba</h1>
        <p className="sub">Kana, kanji et phrases — à ton rythme.</p>
      </header>

      {error && <p className="error">{error}</p>}

      {counts && (
        <section className="stats">
          <div className="stat"><span className="n">{counts.dueNow}</span><span className="l">à réviser</span></div>
          <div className="stat"><span className="n">{Math.min(counts.newAvailable, counts.newLeftToday)}</span><span className="l">nouvelles</span></div>
          <div className="stat"><span className="n">{counts.learned}</span><span className="l">apprises</span></div>
          <div className="stat"><span className="n">{counts.reviewsToday}</span><span className="l">aujourd'hui</span></div>
        </section>
      )}

      <button className="primary" disabled={!counts || pending === 0} onClick={() => setScreen('review')}>
        {pending > 0 ? `Réviser — ${pending} carte${pending > 1 ? 's' : ''}` : 'Rien à réviser pour l’instant'}
      </button>

      {counts && counts.cards === 0 && (
        <p className="hint">Choisis ce que tu veux apprendre, puis crée le paquet.</p>
      )}

      <section className="deck">
        <h2>Le paquet</h2>
        <p className="hint">
          {counts ? `${counts.cards} cartes` : '…'} — deux cartes par kana : lire le signe, puis le reconnaître.
        </p>

        <div className="picker">
          {SCRIPTS.map(s => (
            <button
              key={s.key}
              className={`chip ${scripts.includes(s.key) ? 'on' : ''}`}
              onClick={() => setScripts(scripts.includes(s.key) ? scripts.filter(x => x !== s.key) : [...scripts, s.key])}
            >
              <span className="jp">{s.sample}</span>
              {s.label}
            </button>
          ))}
        </div>

        <div className="picker">
          {GROUPS.map(g => (
            <button
              key={g.key}
              className={`chip ${groups.includes(g.key) ? 'on' : ''}`}
              onClick={() => setGroups(groups.includes(g.key) ? groups.filter(x => x !== g.key) : [...groups, g.key])}
            >
              {g.label}
              <small>{g.hint}</small>
            </button>
          ))}
        </div>

        <button className="secondary" onClick={create} disabled={busy || !scripts.length || !groups.length}>
          {busy ? 'Création…' : 'Ajouter au paquet'}
        </button>
      </section>
    </main>
  )
}
