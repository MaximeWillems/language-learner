import { useEffect, useRef, useState } from 'react'
import { matchesAnyReading, matchesKana } from '../shared/normalize'
import type { QueueCard, Rating } from '../shared/types'
import { getQueue, sendReview } from './api'

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
  'meaning:kanji': 'Que signifie ce kanji ?'
}

const answerOf = (c: QueueCard) => (c.kind === 'meaning' ? c.meanings[0] ?? '' : c.glyph)

function isRight(c: QueueCard, answer: string): boolean {
  if (c.kind === 'meaning' || c.kind === 'recall') return answer === answerOf(c)
  if (c.script === 'kanji') return matchesAnyReading(answer, [...c.onReadings, ...c.kunReadings])
  return matchesKana(answer, c.glyph, c.reading)
}

export default function Review({ onDone }: { onDone: () => void }) {
  const [cards, setCards] = useState<QueueCard[] | null>(null)
  const [i, setI] = useState(0)
  const [input, setInput] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [correct, setCorrect] = useState(false)
  const [score, setScore] = useState({ ok: 0, ko: 0 })
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const box = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getQueue(30).then(r => setCards(r.cards)).catch(e => setError(String(e)))
  }, [])

  const card = cards?.[i]
  const typed = card?.kind === 'reading'

  useEffect(() => {
    if (card && !revealed && typed) box.current?.focus()
  }, [card, revealed, typed])

  const reveal = (answer: string) => {
    if (!card || revealed || !answer.trim()) return
    const ok = isRight(card, answer)
    setCorrect(ok)
    setRevealed(true)
    setScore(s => ({ ok: s.ok + (ok ? 1 : 0), ko: s.ko + (ok ? 0 : 1) }))
  }

  const rate = async (r: Rating) => {
    if (!card || !revealed || sending) return
    setSending(true)
    try {
      await sendReview({ cardId: card.id, rating: r, answer: input || null, correct })
    } catch (e) {
      setError(String(e))
      return
    } finally {
      setSending(false)
    }
    setInput('')
    setRevealed(false)
    setI(i + 1)
  }

  const suggested: Rating = correct ? 3 : 1

  useEffect(() => {
    if (!revealed) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); rate(suggested) }
      else if (['1', '2', '3', '4'].includes(e.key)) { e.preventDefault(); rate(Number(e.key) as Rating) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, suggested, card, input, correct, sending])

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
    return (
      <main className="page done">
        <span className="jp brand">お疲れ様</span>
        <h1>Session terminée</h1>
        <p className="sub">{score.ok} juste{score.ok > 1 ? 's' : ''} · {score.ko} raté{score.ko > 1 ? 's' : ''}</p>
        <button className="primary" onClick={onDone}>Retour</button>
      </main>
    )
  }

  const total = cards.length
  const answer = answerOf(card)
  const choiceClass = (ch: string) => {
    const parts = ['choice']
    if (card.kind === 'recall') parts.push('jp')
    if (revealed && ch === answer) parts.push('good')
    if (revealed && ch === input && !correct) parts.push('bad')
    return parts.join(' ')
  }

  return (
    <main className="page review">
      <div className="bar">
        <div className="progress"><span style={{ width: (i / total) * 100 + '%' }} /></div>
        <span className="mono">{i + 1} / {total}</span>
        <button className="link" onClick={onDone}>Quitter</button>
      </div>

      <div className="card">
        {card.isNew && <span className="badge">nouvelle</span>}
        {card.strokes !== null && <span className="strokes mono">{card.strokes} traits</span>}

        <span className="prompt-label">{PROMPTS[card.kind + ':' + card.script] ?? 'À toi'}</span>

        {card.kind === 'recall'
          ? <span className="romaji">{card.reading}</span>
          : <span className="glyph jp">{card.glyph}</span>}

        {typed ? (
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
        ) : (
          <div className={card.kind === 'meaning' ? 'choices text' : 'choices'}>
            {card.choices.map(ch => (
              <button key={ch} className={choiceClass(ch)} disabled={revealed} onClick={() => { setInput(ch); reveal(ch) }}>
                {ch}
              </button>
            ))}
          </div>
        )}

        {revealed && (
          <div className="verdict">
            <span className={correct ? 'good' : 'bad'}>{correct ? 'Juste' : 'Raté'}</span>

            {card.script === 'kanji' ? (
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
                <span className="jp big">{card.glyph}</span> = {card.reading}
              </span>
            )}

            {!correct && (
              <button className="link" onClick={() => { setCorrect(true); setScore(s => ({ ok: s.ok + 1, ko: s.ko - 1 })) }}>
                en fait c’était juste
              </button>
            )}
          </div>
        )}
      </div>

      {revealed && (
        <div className="ratings">
          {RATINGS.map(r => (
            <button key={r.v} className={r.v === suggested ? 'rating suggested' : 'rating'} onClick={() => rate(r.v)}>
              <span className="k">{r.label}</span>
              <span className="iv mono">{card.previews[r.v]}</span>
            </button>
          ))}
        </div>
      )}

      {!revealed && typed && <p className="hint">Entrée pour valider</p>}
    </main>
  )
}
