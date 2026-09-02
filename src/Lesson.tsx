import { useEffect, useState } from 'react'
import type { Counts, Lesson as Data } from '../shared/types'
import { completeLesson, getLesson } from './api'

/** Le corps des lecons n'utilise que des paragraphes et du gras : inutile d'embarquer
 *  une bibliotheque Markdown pour deux regles. */
function Body({ text }: { text: string }) {
  return (
    <div className="prose">
      {text.split('\n\n').map((para, i) => (
        <p key={i}>
          {para.split('**').map((bit, n) => (n % 2 ? <strong key={n}>{bit}</strong> : bit))}
        </p>
      ))}
    </div>
  )
}

export default function Lesson({ id, setCounts, onError, onDone }: {
  id: number
  setCounts: (c: Counts) => void
  onError: (m: string) => void
  onDone: () => void
}) {
  const [data, setData] = useState<Data | null>(null)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getLesson(id)
      .then(d => {
        setData(d)
        // pre-cochees : ce qui n'est pas encore dans le paquet. L'utilisateur decoche.
        setPicked(new Set(d.items.filter(i => !i.owned).map(i => i.type + ':' + i.id)))
      })
      .catch(e => onError(String(e)))
  }, [id])

  if (!data) return <p className="hint">Chargement…</p>

  const words = data.items.filter(i => i.role === 'word')
  const examples = data.items.filter(i => i.role === 'example')
  const key = (t: string, n: number) => t + ':' + n
  const toggle = (k: string) =>
    setPicked(s => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  const chosen = (type: string) =>
    data.items.filter(i => i.type === type && picked.has(key(i.type, i.id))).map(i => i.id)

  const finish = async (state: 'done' | 'known') => {
    setBusy(true)
    try {
      setCounts(await completeLesson(id, {
        words: state === 'known' ? [] : chosen('word'),
        sentences: state === 'known' ? [] : chosen('sentence'),
        state
      }))
      onDone()
    } catch (e) {
      onError(String(e))
      setBusy(false)
    }
  }

  const newOnes = data.items.filter(i => !i.owned).length

  return (
    <>
      <section className="panel lessonhead">
        <button className="link" onClick={onDone}>← Retour au parcours</button>
        <span className="who">{data.chapter}</span>
        <h2>{data.title}</h2>
      </section>

      <section className="panel">
        <Body text={data.body} />
      </section>

      {words.length > 0 && (
        <section className="panel">
          <h2>Les mots</h2>
          <ul className="vocab">
            {words.map(w => (
              <li key={w.id}>
                <span className="jp">{w.text}</span>
                <span className="rd jp">{w.reading}</span>
                <span className="fr">{w.gloss}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {examples.length > 0 && (
        <section className="panel">
          <h2>Les exemples</h2>
          <ul className="examples">
            {examples.map(s => (
              <li key={s.id}>
                <span className="jp">{s.text}</span>
                <span className="fr">{s.gloss}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel">
        <h2>Ajouter à ton paquet</h2>
        <p className="hint">
          {newOnes === 0
            ? 'Tout est déjà dans ton paquet. Rien à ajouter.'
            : 'Décoche ce que tu connais déjà — rien n’est ajouté sans ton accord.'}
        </p>

        <ul className="pick">
          {data.items.map(i => {
            const k = key(i.type, i.id)
            return (
              <li key={k} className={i.owned ? 'has' : ''}>
                <label>
                  <input
                    type="checkbox"
                    checked={picked.has(k)}
                    disabled={i.owned}
                    onChange={() => toggle(k)}
                  />
                  <span className="jp">{i.text}</span>
                  <span className="fr">{i.gloss}</span>
                  {i.owned && <span className="flag done">déjà pris</span>}
                </label>
              </li>
            )
          })}
        </ul>

        <div className="finish">
          <button className="primary" disabled={busy} onClick={() => finish('done')}>
            {picked.size > 0 ? `Terminer et ajouter ${picked.size} élément${picked.size > 1 ? 's' : ''}` : 'Terminer sans rien ajouter'}
          </button>
          <button className="secondary" disabled={busy} onClick={() => finish('known')}>
            Je connais déjà tout ça
          </button>
        </div>
      </section>
    </>
  )
}
