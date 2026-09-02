import { useEffect, useState } from 'react'
import type { DayCount, Stats as Data } from '../shared/types'
import { getStats } from './api'

const day = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })

/** Barres proportionnelles au plus haut jour de la periode. */
function Bars({ rows, empty }: { rows: DayCount[]; empty: string }) {
  if (!rows.length) return <p className="hint">{empty}</p>
  const top = Math.max(...rows.map(r => r.n))
  return (
    <ol className="bars">
      {rows.map(r => (
        <li key={r.day}>
          <span className="bar" style={{ height: Math.max(4, (r.n / top) * 100) + '%' }} />
          <span className="v mono">{r.n}</span>
          <span className="d mono">{day(r.day)}</span>
        </li>
      ))}
    </ol>
  )
}

export default function Stats() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { getStats().then(setData).catch(e => setError(String(e))) }, [])

  if (error) return <p className="error">{error}</p>
  if (!data) return <p className="hint">Chargement…</p>

  const total = data.fresh + data.learning + data.known
  const rate = data.answered ? Math.round((data.right / data.answered) * 100) : null

  return (
    <>
      <section className="panel">
        <h2>Où tu en es</h2>
        <div className="track">
          <div><span className="n">{data.known}</span><span className="l">acquises</span></div>
          <div><span className="n">{data.learning}</span><span className="l">en cours</span></div>
          <div><span className="n">{data.fresh}</span><span className="l">jamais vues</span></div>
        </div>
        {total > 0 && (
          <div className="meter" title={`${data.known} acquises sur ${total}`}>
            <span className="known" style={{ width: (data.known / total) * 100 + '%' }} />
            <span className="doing" style={{ width: (data.learning / total) * 100 + '%' }} />
          </div>
        )}
        <p className="hint">
          {rate === null
            ? 'Aucune révision enregistrée pour l’instant.'
            : `${rate} % de bonnes réponses sur ${data.answered} révisions.`}
          {data.streak > 1 && ` ${data.streak} jours d’affilée.`}
        </p>
      </section>

      <section className="panel">
        <h2>Les quatorze derniers jours</h2>
        <Bars rows={data.past} empty="Rien de révisé sur la période." />
      </section>

      <section className="panel">
        <h2>Ce qui arrive</h2>
        <p className="hint">
          Les révisions déjà planifiées, jour par jour. Un pic annonce une journée chargée :
          c’est le moment de lever le pied sur les nouvelles cartes.
        </p>
        <Bars rows={data.ahead} empty="Rien de planifié pour l’instant." />
      </section>
    </>
  )
}
