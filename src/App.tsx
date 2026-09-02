import { useEffect, useState } from 'react'
import type { CardKind, Counts, DeckRequest, PracticeRequest, Script } from '../shared/types'
import { VERSION } from '../shared/version'
import { buildDeck, getCounts, getVersion, saveSettings } from './api'
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

const SENTENCE_LEVELS = [
  { key: 'level1', label: 'Niveau 1', hint: '900 · très simples' },
  { key: 'level2', label: 'Niveau 2', hint: '1800 · courantes' },
  { key: 'level3', label: 'Niveau 3', hint: '2100 · plus longues' },
  { key: 'level4', label: 'Niveau 4', hint: '1200 · kanji avancés' }
]

const DRILL_SCRIPTS: { key: Script; label: string }[] = [
  { key: 'hiragana', label: 'Hiragana' },
  { key: 'katakana', label: 'Katakana' },
  { key: 'kanji', label: 'Kanji' },
  { key: 'sentence', label: 'Phrases' }
]

const DRILL_KINDS: { key: CardKind; label: string; hint: string }[] = [
  { key: 'reading', label: 'Lecture', hint: 'le signe → le son' },
  { key: 'recall', label: 'Reconnaissance', hint: 'le son → le kana' },
  { key: 'meaning', label: 'Sens', hint: 'vers le français' },
  { key: 'cloze', label: 'Texte à trous', hint: 'le mot manquant' }
]

const LABELS: Record<string, string> = {
  hiragana: 'hiragana',
  katakana: 'katakana',
  kanji: 'kanji',
  sentence: 'phrases'
}

const TRACKS: { key: string; label: string; action: string; scripts: Script[] }[] = [
  { key: 'chars', label: 'Caractères', action: 'Réviser les caractères', scripts: ['hiragana', 'katakana', 'kanji'] },
  { key: 'sentences', label: 'Phrases', action: 'Réviser les phrases', scripts: ['sentence'] }
]

const flip = (list: string[], v: string) =>
  list.includes(v) ? list.filter(x => x !== v) : [...list, v]

export default function App() {
  const [counts, setCounts] = useState<Counts | null>(null)
  const [live, setLive] = useState<string | null>(null)
  const [screen, setScreen] = useState<'home' | 'review' | 'practice'>('home')
  const [scripts, setScripts] = useState<Script[]>(['hiragana'])
  const [kanaGroups, setKanaGroups] = useState<string[]>(['gojuon'])
  const [kanjiGroups, setKanjiGroups] = useState<string[]>(['grade1'])
  const [levels, setLevels] = useState<string[]>(['level1'])
  const [drillScripts, setDrillScripts] = useState<Script[]>([])
  const [drillKinds, setDrillKinds] = useState<CardKind[]>([])
  const [cap, setCap] = useState('20')
  const [session, setSession] = useState<PracticeRequest>({ scripts: [], groups: [], kinds: [] })
  const [busy, setBusy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = () =>
    getCounts()
      .then(c => { setCounts(c); setCap(String(c.newPerDay)) })
      .catch(e => setError(String(e)))

  useEffect(() => {
    refresh()
    getVersion().then(v => setLive(v.version)).catch(() => {})
  }, [])

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

  const deck = counts?.deck ?? []
  const total = (rows: typeof deck) => rows.reduce((a, d) => a + d.n, 0)
  const ofScript = (k: Script) => total(deck.filter(d => d.script === k))
  const scoped = drillScripts.length ? deck.filter(d => drillScripts.includes(d.script)) : deck
  const hasKind = (k: CardKind) => scoped.some(d => d.kind === k && d.n > 0)
  const drillFilters: PracticeRequest = {
    scripts: drillScripts,
    groups: [],
    kinds: drillKinds.filter(hasKind)
  }
  const matching = total(
    scoped.filter(d => !drillFilters.kinds.length || drillFilters.kinds.includes(d.kind))
  )
  const summary = (['hiragana', 'katakana', 'kanji', 'sentence'] as Script[])
    .map(k => ({ k, n: ofScript(k) }))
    .filter(x => x.n > 0)
    .map(x => x.n + ' ' + LABELS[x.k])
    .join(' · ')

  if (screen === 'review') return <Review mode="review" filters={session} onDone={back} />
  if (screen === 'practice') return <Review mode="practice" filters={drillFilters} onDone={back} />

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
        <p className="sub">Kana, kanji et phrases — à ton rythme.</p>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="tracks">
        {deck.length === 0 && (
          <p className="hint">
            Ton paquet est vide. Ouvre « Gérer le paquet » plus bas pour choisir ce que tu veux apprendre.
          </p>
        )}
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
                {total === 0
                  ? 'rien à réviser'
                  : `${due} en révision · ${fresh} nouvelle${fresh > 1 ? 's' : ''}`}
              </span>
              <button
                className="primary"
                disabled={total === 0}
                onClick={() => { setSession({ scripts: t.scripts, groups: [], kinds: [] }); setScreen('review') }}
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

      <section className="panel">
        <h2>Entraînement libre</h2>
        <p className="hint">
          Sans limite et sans échéance. Tes réponses sont enregistrées mais
          <strong> ne modifient pas le calendrier de révision</strong> : répondre hors échéance
          ne dit rien de ce que tu as vraiment retenu.
        </p>

        <div className="picker">
          {DRILL_SCRIPTS.map(s => {
            const n = ofScript(s.key)
            return (
              <button
                key={s.key}
                className={drillScripts.includes(s.key) ? 'chip on' : 'chip'}
                disabled={n === 0}
                onClick={() => setDrillScripts(flip(drillScripts, s.key) as Script[])}
              >
                {s.label}
                <small>{n === 0 ? 'absent du paquet' : n + ' cartes'}</small>
              </button>
            )
          })}
        </div>
        <div className="picker">
          {DRILL_KINDS.map(k => (
            <button
              key={k.key}
              className={drillKinds.includes(k.key) ? 'chip on' : 'chip'}
              disabled={!hasKind(k.key)}
              onClick={() => setDrillKinds(flip(drillKinds, k.key) as CardKind[])}
            >
              {k.label}
              <small>{k.hint}</small>
            </button>
          ))}
        </div>

        <button className="secondary wide" disabled={matching === 0} onClick={() => setScreen('practice')}>
          {matching === 0
            ? 'Aucune carte ne correspond'
            : 'S’entraîner — ' + matching + (matching > 1 ? ' cartes' : ' carte')}
        </button>
      </section>

      <details className="panel manage">
        <summary>
          <span>Gérer le paquet</span>
          <small>{summary || 'paquet vide'}</small>
        </summary>

        <div className="body">
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
            {busy === 'kana' ? 'Ajout…' : 'Ajouter ces kana'}
          </button>

          <h3>Kanji</h3>
          <p className="hint">2 136 jōyō, les plus courants d’abord. Sens en français, lectures on et kun.</p>
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
            {busy === 'kanji' ? 'Ajout…' : 'Ajouter ces kanji'}
          </button>

          <h3>Phrases</h3>
          <p className="hint">
            6 000 phrases réelles avec leur traduction française et leur découpage en mots.
            Deux cartes chacune : comprendre le sens, et retrouver un mot manquant.
          </p>
          <div className="picker">
            {SENTENCE_LEVELS.map(g => (
              <button
                key={g.key}
                className={levels.includes(g.key) ? 'chip on' : 'chip'}
                onClick={() => setLevels(flip(levels, g.key))}
              >
                {g.label}
                <small>{g.hint}</small>
              </button>
            ))}
          </div>
          <button
            className="secondary"
            disabled={busy !== '' || !levels.length}
            onClick={() => create('sentence', { scripts: ['sentence'], groups: levels })}
          >
            {busy === 'sentence' ? 'Ajout…' : 'Ajouter ces phrases'}
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
            Ne concerne que les cartes jamais vues, et se répartit entre les écritures
            présentes dans ton paquet. Les révisions dues arrivent toujours en totalité.
          </p>
        </div>
      </details>

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
