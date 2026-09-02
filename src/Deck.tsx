import { useState } from 'react'
import type { CardKind, Counts, DeckRequest, PracticeRequest, Script } from '../shared/types'
import { buildDeck } from './api'

const KANA_SCRIPTS: { key: Script; label: string; sample: string }[] = [
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

const LEVELS = [
  { key: 'level1', label: 'Niveau 1', hint: '900 · très simples' },
  { key: 'level2', label: 'Niveau 2', hint: '1800 · courantes' },
  { key: 'level3', label: 'Niveau 3', hint: '2100 · plus longues' },
  { key: 'level4', label: 'Niveau 4', hint: '1200 · kanji avancés' }
]

const SENTENCE_KINDS: { key: CardKind; label: string; hint: string }[] = [
  { key: 'meaning', label: 'Comprendre', hint: 'la phrase vers le français' },
  { key: 'cloze', label: 'Texte à trous', hint: 'le mot manquant' }
]

const CHAR_KINDS: { key: CardKind; label: string; hint: string }[] = [
  { key: 'reading', label: 'Lecture', hint: 'le signe vers le son' },
  { key: 'recall', label: 'Reconnaissance', hint: 'le son vers le kana' },
  { key: 'meaning', label: 'Sens', hint: 'le kanji vers le français' }
]

const flip = (l: string[], v: string) => (l.includes(v) ? l.filter(x => x !== v) : [...l, v])

export default function Deck({ family, counts, setCounts, onStart, onError }: {
  family: 'chars' | 'sentences'
  counts: Counts | null
  setCounts: (c: Counts) => void
  onStart: (filters: PracticeRequest, mode: 'practice') => void
  onError: (m: string) => void
}) {
  const [scripts, setScripts] = useState<Script[]>(['hiragana'])
  const [kanaGroups, setKanaGroups] = useState<string[]>(['gojuon'])
  const [kanjiGroups, setKanjiGroups] = useState<string[]>(['grade1'])
  const [levels, setLevels] = useState<string[]>(['level1'])
  const [drill, setDrill] = useState<CardKind[]>([])
  const [busy, setBusy] = useState('')

  const chars = family === 'chars'
  const mine = counts?.deck ?? []
  const scope = chars
    ? mine.filter(d => d.script !== 'sentence')
    : mine.filter(d => d.script === 'sentence')
  const owned = scope.reduce((a, d) => a + d.n, 0)
  const kinds = chars ? CHAR_KINDS : SENTENCE_KINDS
  const available = (k: CardKind) => scope.some(d => d.kind === k && d.n > 0)
  const active = drill.filter(available)
  const matching = scope
    .filter(d => !active.length || active.includes(d.kind))
    .reduce((a, d) => a + d.n, 0)

  const add = async (what: string, body: DeckRequest) => {
    setBusy(what)
    try {
      setCounts(await buildDeck(body))
    } catch (e) {
      onError(String(e))
    } finally {
      setBusy('')
    }
  }

  return (
    <>
      <section className="panel">
        <h2>{chars ? 'Ajouter des caractères' : 'Ajouter des phrases'}</h2>

        {chars ? (
          <>
            <h3>Kana</h3>
            <div className="picker">
              {KANA_SCRIPTS.map(s => (
                <button key={s.key} className={scripts.includes(s.key) ? 'chip on' : 'chip'}
                  onClick={() => setScripts(flip(scripts, s.key) as Script[])}>
                  <span className="jp">{s.sample}</span>{s.label}
                </button>
              ))}
            </div>
            <div className="picker">
              {KANA_GROUPS.map(g => (
                <button key={g.key} className={kanaGroups.includes(g.key) ? 'chip on' : 'chip'}
                  onClick={() => setKanaGroups(flip(kanaGroups, g.key))}>
                  {g.label}<small>{g.hint}</small>
                </button>
              ))}
            </div>
            <button className="secondary" disabled={busy !== '' || !scripts.length || !kanaGroups.length}
              onClick={() => add('kana', { scripts, groups: kanaGroups })}>
              {busy === 'kana' ? 'Ajout en cours…' : 'Ajouter ces kana'}
            </button>

            <h3>Kanji</h3>
            <p className="hint">2 136 jōyō, les plus courants d’abord. Sens en français, lectures on et kun.</p>
            <div className="picker">
              {KANJI_GROUPS.map(g => (
                <button key={g.key} className={kanjiGroups.includes(g.key) ? 'chip on' : 'chip'}
                  onClick={() => setKanjiGroups(flip(kanjiGroups, g.key))}>
                  {g.label}<small>{g.hint}</small>
                </button>
              ))}
            </div>
            <button className="secondary" disabled={busy !== '' || !kanjiGroups.length}
              onClick={() => add('kanji', { scripts: ['kanji'], groups: kanjiGroups })}>
              {busy === 'kanji' ? 'Ajout en cours…' : 'Ajouter ces kanji'}
            </button>
          </>
        ) : (
          <>
            <p className="hint">
              6 000 phrases réelles avec leur traduction française et leur découpage en mots.
              Deux cartes chacune : comprendre le sens, et retrouver un mot manquant.
            </p>
            <div className="picker">
              {LEVELS.map(g => (
                <button key={g.key} className={levels.includes(g.key) ? 'chip on' : 'chip'}
                  onClick={() => setLevels(flip(levels, g.key))}>
                  {g.label}<small>{g.hint}</small>
                </button>
              ))}
            </div>
            <button className="secondary" disabled={busy !== '' || !levels.length}
              onClick={() => add('sentence', { scripts: ['sentence'], groups: levels })}>
              {busy === 'sentence' ? 'Ajout en cours…' : 'Ajouter ces phrases'}
            </button>
          </>
        )}
      </section>

      <section className="panel">
        <h2>Entraînement libre</h2>
        <p className="hint">
          Sans limite et sans échéance, dans {chars ? 'tes caractères' : 'tes phrases'}.
          Tes réponses sont enregistrées mais <strong>ne modifient pas le calendrier de révision</strong>.
        </p>

        {owned === 0 ? (
          <p className="hint">Rien à travailler pour l’instant : commence par en ajouter ci-dessus.</p>
        ) : (
          <>
            <div className="picker">
              {kinds.map(k => (
                <button key={k.key} className={drill.includes(k.key) ? 'chip on' : 'chip'}
                  disabled={!available(k.key)}
                  onClick={() => setDrill(flip(drill, k.key) as CardKind[])}>
                  {k.label}<small>{k.hint}</small>
                </button>
              ))}
            </div>
            <button className="secondary wide" disabled={matching === 0}
              onClick={() => onStart({
                scripts: chars ? ['hiragana', 'katakana', 'kanji'] : ['sentence'],
                groups: [],
                kinds: active
              }, 'practice')}>
              {matching === 0 ? 'Aucune carte ne correspond' : 'S’entraîner — ' + matching + (matching > 1 ? ' cartes' : ' carte')}
            </button>
          </>
        )}
      </section>
    </>
  )
}
