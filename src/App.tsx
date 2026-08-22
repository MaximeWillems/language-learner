import { useEffect, useState } from 'react'
import type { CardKind, Counts, DeckRequest, PracticeRequest, Script } from '../shared/types'
import { buildDeck, getCounts, saveSettings } from './api'
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

const DRILL_SCRIPTS: { key: Script; label: string }[] = [
  { key: 'hiragana', label: 'Hiragana' },
  { key: 'katakana', label: 'Katakana' },
  { key: 'kanji', label: 'Kanji' }
]

const DRILL_KINDS: { key: CardKind; label: string; hint: string }[] = [
  { key: 'reading', label: 'Lecture', hint: 'le signe → le son' },
  { key: 'recall', label: 'Reconnaissance', hint: 'le son → le kana' },
  { key: 'meaning', label: 'Sens', hint: 'le kanji → le français' }
]

const flip = (list: string[], v: string) =>
  list.includes(v) ? list.filter(x => x !== v) : [...list, v]

const NO_FILTER: PracticeRequest = { scripts: [], groups: [], kinds: [] }

export default function App() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [screen, setScreen] = useState<'home' | 'review' | 'practice'>('home')
  const [scripts, setScripts] = useState<Script[]>(['hiragana'])
  const [kanaGroups, setKanaGroups] = useState<string[]>(['gojuon'])
  const [kanjiGroups, setKanjiGroups] = useState<string[]>(['grade1'])
  const [drillScripts, setDrillScripts] = useState<Script[]>([])
  const [drillKinds, setDrillKinds] = useState<CardKind[]>([])
  const [cap, setCap] = useState('20')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () =>
    getCounts()
      .then(c => { setCounts(c); setCap(String(c.newPerDay)) })
      .catch(e => setError(String(e)))

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

  const commitCap = async () => {
    const n = Number(cap)
    if (!Number.isFinite(n) || n < 0 || n === counts?.newPerDay) return
    try {
      const c = await saveSettings(Math.min(500, Math.round(n)))
      setCounts(c)
      setCap(String(c.newPerDay))
    } catch (e) {
      setError(String(e))
    }
  }

  const back = () => { setScreen('home'); refresh() }

  if (screen === 'review') return <Review mode="review" filters={NO_FILTER} onDone={back} />
  if (screen === 'practice') {
    return <Review mode="practice" filters={{ scripts: drillScripts, groups: [], kinds: drillKinds }} onDone={back} />
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
        <h2>Entraînement libre</h2>
        <p className="hint">
          Sans limite et sans échéance : tire au hasard dans ton paquet, aussi longtemps que tu veux.
          Tes réponses sont enregistrées mais <strong>ne modifient pas le calendrier de révision</strong> —
          répondre hors échéance ne dit rien de ce que tu as vraiment retenu.
        </p>

        <div className="picker">
          {DRILL_SCRIPTS.map(s => (
            <button
              key={s.key}
              className={drillScripts.includes(s.key) ? 'chip on' : 'chip'}
              onClick={() => setDrillScripts(flip(drillScripts, s.key) as Script[])}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="picker">
          {DRILL_KINDS.map(k => (
            <button
              key={k.key}
              className={drillKinds.includes(k.key) ? 'chip on' : 'chip'}
              onClick={() => setDrillKinds(flip(drillKinds, k.key) as CardKind[])}
            >
              {k.label}
              <small>{k.hint}</small>
            </button>
          ))}
        </div>
        <p className="hint">
          {drillScripts.length === 0 && drillKinds.length === 0
            ? 'Rien de sélectionné : tout le paquet.'
            : 'Ne garde que ce qui est sélectionné.'}
        </p>
        <button className="secondary" disabled={!counts || counts.cards === 0} onClick={() => setScreen('practice')}>
          S’entraîner
        </button>
      </section>

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
        <p className="hint">2 136 kanji jōyō, les plus courants d’abord. Sens en français, lectures on et kun.</p>
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

        <h3>Rythme</h3>
        <label className="setting">
          <span>Nouvelles cartes par jour</span>
          <input
            type="number"
            min={0}
            max={500}
            value={cap}
            onChange={e => setCap(e.target.value)}
            onBlur={commitCap}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          />
        </label>
        <p className="hint">
          Ce plafond ne concerne que les cartes jamais vues. Les révisions dues arrivent
          toujours en totalité — c’est ce qui empêche la dette de s’accumuler sans que tu le voies.
        </p>
      </section>

      <footer className="credits">
        Données kanji :{' '}
        <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project" target="_blank" rel="noreferrer">KANJIDIC2</a>,
        Electronic Dictionary Research and Development Group, licence CC BY-SA.
      </footer>
    </main>
  )
}
