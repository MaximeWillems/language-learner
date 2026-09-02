import { useEffect, useState } from 'react'
import type { CardAction, CardIssue, CardKind, Counts, Review as Log } from '../shared/types'
import { cardAction, getHardCards, getHistory, saveSettings } from './api'

const KIND_LABEL: Record<CardKind, string> = {
  reading: 'lecture',
  recall: 'reconnaissance',
  meaning: 'sens',
  cloze: 'texte à trous'
}

const RATING_LABEL: Record<number, string> = { 1: 'raté', 2: 'dur', 3: 'bon', 4: 'facile' }

export default function Settings({ counts, setCounts, onError }: {
  counts: Counts | null
  setCounts: (c: Counts) => void
  onError: (m: string) => void
}) {
  const [cap, setCap] = useState(String(counts?.newPerDay ?? 20))
  const [issues, setIssues] = useState<CardIssue[] | null>(null)
  const [history, setHistory] = useState<Record<number, Log[]>>({})

  useEffect(() => { if (counts) setCap(String(counts.newPerDay)) }, [counts?.newPerDay])

  const load = () => {
    setIssues(null)
    getHardCards().then(setIssues).catch(e => onError(String(e)))
  }

  useEffect(() => { load() }, [])

  const commitCap = async () => {
    const n = Number(cap)
    if (!Number.isFinite(n) || n < 0 || n === counts?.newPerDay) return
    try {
      setCounts(await saveSettings(Math.min(500, Math.round(n))))
    } catch (e) {
      onError(String(e))
    }
  }

  const run = async (id: number, action: CardAction) => {
    try {
      setCounts(await cardAction(id, action))
      load()
    } catch (e) {
      onError(String(e))
    }
  }

  const toggle = async (id: number) => {
    if (history[id]) {
      setHistory(h => { const n = { ...h }; delete n[id]; return n })
      return
    }
    try {
      const rows = await getHistory(id)
      setHistory(h => ({ ...h, [id]: rows }))
    } catch (e) {
      onError(String(e))
    }
  }

  const problems = issues ?? []

  return (
    <>
      <section className="panel">
        <h2>Rythme</h2>
        <label className="setting">
          <span>Nouvelles cartes par jour</span>
          <input type="number" min={0} max={500} value={cap}
            onChange={e => setCap(e.target.value)}
            onBlur={commitCap}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        </label>
        <p className="hint">
          Ne concerne que les cartes jamais vues, et se répartit entre les familles présentes
          dans ton paquet. Les révisions dues arrivent toujours en totalité — c’est ce qui
          empêche la dette de s’accumuler sans que tu la voies.
        </p>
      </section>

      <section className="panel">
        <h2>Cartes à problème</h2>
        <p className="hint">
          Une carte oubliée six fois ou plus ne s’ancre pas en la répétant davantage.
          Mets-la de côté, ou repars de zéro pour la réapprendre comme une nouveauté.
        </p>

        {issues === null ? (
          <p className="hint">Chargement…</p>
        ) : problems.length === 0 ? (
          <p className="hint">Rien à signaler. Aucune carte ne te résiste pour l’instant.</p>
        ) : (
          <ul className="issues">
            {problems.map(c => (
              <li className={c.suspended ? 'issue off' : 'issue'} key={c.id}>
                <span className={c.script === 'sentence' ? 'jp phrase-mini' : 'jp'}>{c.text}</span>
                <span className="meta mono">
                  {KIND_LABEL[c.kind]}
                  {c.lapses > 0 && ` · ${c.lapses} oubli${c.lapses > 1 ? 's' : ''}`}
                  {c.answered > 0 && ` · ${c.right}/${c.answered} justes`}
                  {c.suspended && ' · de côté'}
                </span>
                <span className="acts">
                  <button className="link" onClick={() => run(c.id, c.suspended ? 'unsuspend' : 'suspend')}>
                    {c.suspended ? 'Réactiver' : 'Mettre de côté'}
                  </button>
                  <button className="link" onClick={() => run(c.id, 'reset')}>Repartir de zéro</button>
                  <button className="link" onClick={() => toggle(c.id)}>
                    {history[c.id] ? 'Masquer' : 'Historique'}
                  </button>
                </span>
                {history[c.id] && (
                  <ol className="log mono">
                    {history[c.id].length === 0 && <li>aucune révision enregistrée</li>}
                    {history[c.id].map((h, n) => (
                      <li key={n}>
                        {new Date(h.reviewedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        {' · '}{RATING_LABEL[h.rating] ?? h.rating}
                        {h.mode === 'practice' && ' · entraînement'}
                        {h.answer && ` · « ${h.answer} »`}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
