import { useEffect, useState } from 'react'
import type { Counts, PracticeRequest } from '../shared/types'
import { VERSION } from '../shared/version'
import { getCounts, getVersion } from './api'
import Course from './Course'
import Deck from './Deck'
import Home from './Home'
import Review from './Review'
import Settings from './Settings'
import Stats from './Stats'

type Tab = 'home' | 'course' | 'chars' | 'words' | 'sentences' | 'stats' | 'settings'

const TABS: { key: Tab; label: string }[] = [
  { key: 'home', label: 'Réviser' },
  { key: 'course', label: 'Parcours' },
  { key: 'chars', label: 'Caractères' },
  { key: 'words', label: 'Vocabulaire' },
  { key: 'sentences', label: 'Phrases' },
  { key: 'stats', label: 'Statistiques' },
  { key: 'settings', label: 'Réglages' }
]

interface Session {
  mode: 'review' | 'practice'
  filters: PracticeRequest
}

export default function App() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [live, setLive] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => getCounts().then(setCounts).catch(e => setError(String(e)))

  useEffect(() => {
    refresh()
    getVersion().then(v => setLive(v.version)).catch(() => {})
  }, [])

  const start = (filters: PracticeRequest, mode: 'review' | 'practice' = 'review') =>
    setSession({ mode, filters })

  if (session) {
    return (
      <Review
        mode={session.mode}
        filters={session.filters}
        onDone={() => { setSession(null); refresh() }}
      />
    )
  }

  const stale = live !== null && live !== VERSION

  return (
    <main className="page">
      {stale && (
        <div className="banner">
          <span>Version {live} déployée — ton onglet affiche encore la {VERSION}.</span>
          <button className="link" onClick={() => location.reload()}>Recharger</button>
        </div>
      )}

      <header className="head">
        <div className="titleline">
          <span className="jp brand">言葉</span>
          <h1>Kotoba</h1>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={tab === t.key ? 'tab on' : 'tab'}
            onClick={() => { setTab(t.key); setError(null) }}
          >
            {t.label}
            {t.key === 'settings' && counts && counts.hard > 0 && <span className="dot" />}
          </button>
        ))}
      </nav>

      {error && <p className="error">{error}</p>}

      {tab === 'home' && <Home counts={counts} onStart={start} />}
      {tab === 'course' && <Course setCounts={setCounts} onError={setError} />}
      {tab === 'chars' && (
        <Deck family="chars" counts={counts} setCounts={setCounts} onStart={start} onError={setError} />
      )}
      {tab === 'words' && (
        <Deck family="words" counts={counts} setCounts={setCounts} onStart={start} onError={setError} />
      )}
      {tab === 'sentences' && (
        <Deck family="sentences" counts={counts} setCounts={setCounts} onStart={start} onError={setError} />
      )}
      {tab === 'stats' && <Stats />}
      {tab === 'settings' && <Settings counts={counts} setCounts={setCounts} onError={setError} />}

      <footer className="credits">
        <span className="mono">Kotoba {VERSION}</span>
        <span>
          Kanji et découpage des phrases :{' '}
          <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noreferrer">KANJIDIC2</a>
          {' '}et corpus Tanaka, Electronic Dictionary Research and Development Group, CC BY-SA.
          Phrases et traductions :{' '}
          <a href="https://tatoeba.org" target="_blank" rel="noreferrer">Tatoeba</a>, CC BY 2.0 FR.
        </span>
      </footer>
    </main>
  )
}
