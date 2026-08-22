import { useEffect, useState } from 'react'
import type { Counts, DeckRequest, Script } from '../shared/types'
import { buildDeck, getCounts } from './api'
import Review from './Review'

const SCRIPTS: { key: Script; label: string; sample: string }[] = [
  { key: 'hiragana', label: 'Hiragana', sample: 'あいう' },
  { key: 'katakana', label: 'Katakana', sample: 'アイウ' }
]

const KANA_GROUPS = [
  { key: 'gojuon', label: 'Gojūon', hint: 'les 46 de base' },
  { key: 'dakuten', label: 'Dakuten', hint: 'が ざ だ ば ぱ' },
  { key: 'yoon', label: 'Yōon', hint: 'きゃ しゅ ちょ' }
]

const KANJI_GROUPS = [
  { key: 'grade1', label: '1re année', hint: '80' },
  { key: 'grade2', label: '2e année', hint: '160' },
  { key: 'grade3', label: '3e année', hint: '200' },
  { key: 'grade4', label: '4e année', hint: '202' },
  { key: 'grade5', label: '5e année', hint: '193' },
  { key: 'grade6', label: '6e année', hint: '191' },
  { key: 'college', label: 'Collège', hint: '1110' }
]

const flip = (list: string[], v: string) =>
  list.includes(v) ? list.filter(x => x !== v) : [...list, v]

export default function App() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [screen, setScreen] = useState<'home' | 'review'>('home')
  const [scripts, setScripts] = useState<Script[]>(['hiragana'])
  const [kanaGroups, setKanaGroups] = useState<string[]>(['gojuon'])
  const [kanjiGroups, setKanjiGroups] = useState<string[]>(['grade1'])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () => getCounts().then(setCounts).catch(e => setError(String(e)))

  useEffect(() => { refresh() }, [])

  const create = async (what: string, body: DeckRequest) => {
    setBusy(what)
    setError(null)
    try {
      setCounts(await buildDeck(body))
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy('')
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
          <div className="stat"><span className="n">{counts.reviewsToday}</span><span className="l">aujourd’hui</span></div>
        </section>
      )}

      <button className="primary" disabled={!counts || pending === 0} onClick={() => setScreen('review')}>
        {pending > 0 ? 'Réviser — ' + pending + (pending > 1 ? ' cartes' : ' carte') : 'Rien à réviser pour l’instant'}
      </button>

      <section className="deck">
        <h2>Le paquet</h2>
        <p className="hint">
          {counts ? counts.cards + ' cartes' : '…'} — deux cartes par caractère.
          Un kana se lit et se reconnaît ; un kanji se traduit et se lit.
        </p>

        <h3>Kana</h3>
        <div className="picker">
          {SCRIPTS.map(s => (
            <button
              key={s.key}
              className={scripts.includes(s.key) ? 'chip on' : 'chip'}
              onClick={() => setScripts(flip(scripts, s.key) as Script[])}
            >
              <span className="jp">{s.sample}</span>
              {s.label}
            </button>
          ))}
        </div>
        <div className="picker">
          {KANA_GROUPS.map(g => (
            <button
              key={g.key}
              className={kanaGroups.includes(g.key) ? 'chip on' : 'chip'}
              onClick={() => setKanaGroups(flip(kanaGroups, g.key))}
            >
              {g.label}
              <small>{g.hint}</small>
            </button>
          ))}
        </div>
        <button
          className="secondary"
          disabled={busy !== '' || !scripts.length || !kanaGroups.length}
          onClick={() => create('kana', { scripts, groups: kanaGroups })}
        >
          {busy === 'kana' ? 'Création…' : 'Ajouter ces kana'}
        </button>

        <h3>Kanji</h3>
        <p className="hint">
          2 136 kanji jōyō, les plus courants d’abord. Sens en français, lectures on et kun.
        </p>
        <div className="picker">
          {KANJI_GROUPS.map(g => (
            <button
              key={g.key}
              className={kanjiGroups.includes(g.key) ? 'chip on' : 'chip'}
              onClick={() => setKanjiGroups(flip(kanjiGroups, g.key))}
            >
              {g.label}
              <small>{g.hint}</small>
            </button>
          ))}
        </div>
        <button
          className="secondary"
          disabled={busy !== '' || !kanjiGroups.length}
          onClick={() => create('kanji', { scripts: ['kanji'], groups: kanjiGroups })}
        >
          {busy === 'kanji' ? 'Création…' : 'Ajouter ces kanji'}
        </button>
      </section>

      <footer className="credits">
        Données kanji :{' '}
        <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noreferrer">KANJIDIC2</a>,
        Electronic Dictionary Research and Development Group, licence CC BY-SA.
      </footer>
    </main>
  )
}
