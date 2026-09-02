import { useEffect, useRef, useState } from 'react'
import { matchesAnyReading, matchesKana } from '../shared/normalize'
import type { CardAction, PracticeRequest, QueueCard, Rating } from '../shared/types'
import { LEECH } from '../shared/types'
import { cardAction, getPractice, getQueue, logPractice, sendReview } from './api'

const RATINGS: { v: Rating; label: string }[] = [
  { v: 1, label: 'Encore' },
  { v: 2, label: 'Dur' },
  { v: 3, label: 'Bon' },
  { v: 4, label: 'Facile' }
]

const PROMPTS: Record<string, string> = {
  'reading:hiragana': 'Lis cet hiragana',
  'reading:katakana': 'Lis ce katakana',
  'reading:kanji': 'Donne une lecture de ce kanji',
  'recall:hiragana': 'Retrouve l’hiragana',
  'recall:katakana': 'Retrouve le katakana',
  'meaning:kanji': 'Que signifie ce kanji ?',
  'meaning:sentence': 'Que veut dire cette phrase ?',
  'cloze:sentence': 'Complète la phrase'
}

// Une carte replanifiee a moins de 20 min appartient encore a cette seance : FSRS fait
// repasser les cartes neuves et ratees par des paliers en minutes.
const BATCH = 30
const HORIZON = 20 * 60 * 1000
const GAP = 4
const MAX_REPEATS = 4

const answerOf = (c: QueueCard) =>
  c.kind === 'meaning' ? c.meanings[0] ?? ''
  : c.kind === 'cloze' ? c.words[c.blank] ?? ''
  : c.text

/** Trois formes : on tape, on choisit, ou on se juge apres avoir retourne la carte. */
const formOf = (c: QueueCard) =>
  c.kind === 'reading' ? 'typed' : c.choices.length ? 'choice' : 'reveal'

function isRight(c: QueueCard, answer: string): boolean {
  if (c.kind === 'recall' || c.kind === 'cloze') return answer === answerOf(c)
  if (c.kind === 'meaning') return c.script === 'kanji' ? answer === answerOf(c) : true
  if (c.script === 'kanji') return matchesAnyReading(answer, [...c.onReadings, ...c.kunReadings])
  return matchesKana(answer, c.text, c.reading)
}

export default function Review({ mode, filters, onDone }: {
  mode: 'review' | 'practice'
  filters: PracticeRequest
  onDone: () => void
}) {
  const practice = mode === 'practice'
  const [cards, setCards] = useState<QueueCard[] | null>(null)
  const [i, setI] = useState(0)
  const [seen, setSeen] = useState(0)
  const [input, setInput] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [score, setScore] = useState({ ok: 0, ko: 0 })
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const box = useRef<HTMLInputElement>(null)
  const repeats = useRef(new Map<number, number>())

  const fetchBatch = () => (practice ? getPractice(filters, BATCH) : getQueue(filters, BATCH))

  useEffect(() => {
    fetchBatch().then(r => setCards(r.cards)).catch(e => setError(String(e)))
  }, [])

  const card = cards?.[i]
  const form = card ? formOf(card) : 'reveal'

  useEffect(() => {
    if (card && !revealed && form === 'typed') box.current?.focus()
  }, [card, revealed, form])

  const reveal = (answer: string) => {
    if (!card || revealed) return
    if (form !== 'reveal' && !answer.trim()) return
    const ok = form === 'reveal' ? true : isRight(card, answer)
    setCorrect(ok)
    setRevealed(true)
    if (form !== 'reveal') setScore(s => ({ ok: s.ok + (ok ? 1 : 0), ko: s.ko + (ok ? 0 : 1) }))
  }

  const rate = async (r: Rating) => {
    if (!card || !revealed || sending || !cards) return
    setSending(true)
    try {
      const res = await sendReview({ cardId: card.id, rating: r, answer: input || null, correct })
      const shown = (repeats.current.get(card.id) ?? 0) + 1
      repeats.current.set(card.id, shown)

      if (new Date(res.due).getTime() - Date.now() < HORIZON && shown <= MAX_REPEATS) {
        const list = [...cards]
        list.splice(Math.min(i + 1 + GAP, list.length), 0, { ...card, isNew: false, previews: res.previews })
        setCards(list)
      }
      setInput('')
      setRevealed(false)
      setSeen(seen + 1)
      setI(i + 1)
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  const next = async (knew = correct) => {
    if (!card || !revealed || sending) return
    setSending(true)
    try {
      await logPractice({ cardId: card.id, answer: input || null, correct: knew })
      setInput('')
      setRevealed(false)
      setSeen(seen + 1)
      if (cards && i + 1 >= cards.length) {
        const r = await fetchBatch()
        setCards(r.cards)
        setI(0)
      } else {
        setI(i + 1)
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  // Suspendre ou reinitialiser depuis la seance : c'est la, en butant dessus, qu'on
  // se rend compte qu'une carte ne passe pas.
  const act = async (action: CardAction) => {
    if (!card || sending || !cards) return
    setSending(true)
    try {
      await cardAction(card.id, action)
      setCards(cards.filter((x, n) => n <= i || x.id !== card.id))
      setInput('')
      setRevealed(false)
      setI(i + 1)
    } catch (e) {
      setError(String(e))
    } finally {
      setSending(false)
    }
  }

  const suggested: Rating = correct ? 3 : 1

  useEffect(() => {
    if (!revealed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); practice ? next() : rate(suggested) }
      else if (!practice && ['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); rate(Number(e.key) as Rating) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, suggested, card, input, correct, sending, practice])

  if (error) {
    return (
      <main className="page">
        <p className="error">{error}</p>
        <button className="secondary" onClick={onDone}>Retour</button>
      </main>
    )
  }

  if (!cards) return <main className="page"><p className="hint">Chargement…</p></main>

  if (!card) {
    const empty = seen === 0
    return (
      <main className="page done">
        <span className="jp brand">{empty ? '空' : 'お疲れ様'}</span>
        <h1>{empty ? 'Rien à travailler' : practice ? 'Entraînement terminé' : 'Session terminée'}</h1>
        <p className="sub">
          {empty
            ? 'Aucune carte ne correspond. Ajoute du contenu au paquet, ou élargis la sélection.'
            : `${score.ok} juste${score.ok > 1 ? 's' : ''} · ${score.ko} raté${score.ko > 1 ? 's' : ''} sur ${seen}`}
        </p>
        <button className="primary" onClick={onDone}>Retour</button>
      </main>
    )
  }

  const answer = answerOf(card)
  const sentence = card.script === 'sentence'
  const choiceClass = (ch: string) => {
    const parts = ['choice']
    if (card.kind === 'recall') parts.push('jp')
    if (card.kind === 'cloze') parts.push('jp', 'word')
    if (revealed && ch === answer) parts.push('good')
    if (revealed && ch === input && !correct) parts.push('bad')
    return parts.join(' ')
  }

  return (
    <main className="page review">
      <div className="bar">
        {practice
          ? <span className="tag">entraînement libre</span>
          : <div className="progress"><span style={{ width: (i / cards.length) * 100 + '%' }} /></div>}
        <span className="mono">{practice ? `${seen} vues` : `${i + 1} / ${cards.length}`}</span>
        <button className="link" onClick={onDone}>Quitter</button>
      </div>

      <div className={sentence ? 'card sentence' : 'card'}>
        {!practice && card.isNew && <span className="badge">nouvelle</span>}
        {!practice && !card.isNew && card.lapses >= LEECH && (
          <span className="badge leech">{card.lapses} oublis</span>
        )}
        {card.strokes !== null && <span className="strokes mono">{card.strokes} traits</span>}

        <span className="prompt-label">{PROMPTS[card.kind + ':' + card.script] ?? 'À toi'}</span>

        {card.kind === 'cloze' ? (
          <p className="jp phrase">
            {card.words.map((w, n) =>
              n === card.blank
                ? <b key={n} className={revealed ? 'gap filled' : 'gap'}>{revealed ? w : '＿＿'}</b>
                : <span key={n}>{w}</span>
            )}
          </p>
        ) : card.kind === 'recall' ? (
          <span className="romaji">{card.reading}</span>
        ) : sentence ? (
          <p className="jp phrase">{card.text}</p>
        ) : (
          <span className="glyph jp">{card.text}</span>
        )}

        {form === 'typed' && (
          <form onSubmit={e => { e.preventDefault(); reveal(input) }}>
            <input
              ref={box}
              className="answer"
              value={input}
              onChange={e => setInput(e.target.value)}
              readOnly={revealed}
              placeholder={card.script === 'kanji' ? 'une lecture, en kana ou rōmaji' : 'rōmaji ou kana'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </form>
        )}

        {form === 'choice' && (
          <div className={card.kind === 'meaning' || card.kind === 'cloze' ? 'choices text' : 'choices'}>
            {card.choices.map(ch => (
              <button key={ch} className={choiceClass(ch)} disabled={revealed} onClick={() => { setInput(ch); reveal(ch) }}>
                {ch}
              </button>
            ))}
          </div>
        )}

        {form === 'reveal' && !revealed && (
          <button className="secondary wide" onClick={() => reveal('')}>Afficher la traduction</button>
        )}

        {revealed && (
          <div className="verdict">
            {form !== 'reveal' && (
              <span className={correct ? 'good' : 'bad'}>{correct ? 'Juste' : 'Raté'}</span>
            )}

            {sentence ? (
              <div className="detail">
                <span className="sens">{card.translation}</span>
                {card.kind === 'cloze' && <span className="lectures jp">{card.text}</span>}
              </div>
            ) : card.script === 'kanji' ? (
              <div className="detail">
                <span className="sens">
                  {card.meanings.join(', ')}
                  {card.meaningLang === 'en' && <em> — sens en anglais, pas de traduction française disponible</em>}
                </span>
                <span className="lectures">
                  {card.onReadings.length > 0 && <span>on <b className="jp">{card.onReadings.join('・')}</b></span>}
                  {card.kunReadings.length > 0 && <span>kun <b className="jp">{card.kunReadings.join('・')}</b></span>}
                </span>
              </div>
            ) : (
              <span className="detail">
                <span className="jp big">{card.text}</span> = {card.reading}
              </span>
            )}

            {form !== 'reveal' && !correct && (
              <button className="link" onClick={() => { setCorrect(true); setScore(s => ({ ok: s.ok + 1, ko: s.ko - 1 })) }}>
                en fait c’était juste
              </button>
            )}
          </div>
        )}
      </div>

      {revealed && (practice ? (
        form === 'reveal' ? (
          <div className="ratings two">
            <button className="rating" disabled={sending} onClick={() => next(false)}>
              <span className="k">Je ne savais pas</span>
            </button>
            <button className="rating suggested" disabled={sending} onClick={() => next(true)}>
              <span className="k">Je savais</span>
            </button>
          </div>
        ) : (
          <button className="primary" disabled={sending} onClick={() => next()}>Continuer</button>
        )
      ) : (
        <div className="ratings">
          {RATINGS.map(r => (
            <button key={r.v} className={r.v === suggested ? 'rating suggested' : 'rating'} onClick={() => rate(r.v)}>
              <span className="k">{r.label}</span>
              <span className="iv mono">{card.previews[r.v]}</span>
            </button>
          ))}
        </div>
      ))}

      {revealed && !practice && (
        <div className="cardacts">
          <button className="link" disabled={sending} onClick={() => act('suspend')}>Mettre de côté</button>
          <button className="link" disabled={sending} onClick={() => act('reset')}>Repartir de zéro</button>
        </div>
      )}

      {!revealed && form === 'typed' && <p className="hint">Entrée pour valider</p>}
    </main>
  )
}
