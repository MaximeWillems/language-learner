import { useEffect, useState } from 'react'
import type { Chapter, Counts } from '../shared/types'
import { getCourse } from './api'
import Lesson from './Lesson'

/** Ni note ni pourcentage : ce qu'on veut voir, c'est s'il reste quelque chose a prendre. */
function Cover({ items, owned, known }: { items: number; owned: number; known: number }) {
  if (items === 0) return <span className="cover none">rien à ajouter</span>
  const full = owned === items
  return (
    <span className={full ? 'cover full' : 'cover'}>
      <span className="gauge">
        <span className="k" style={{ width: (known / items) * 100 + '%' }} />
        <span className="o" style={{ width: ((owned - known) / items) * 100 + '%' }} />
      </span>
      {full ? `${items} éléments, tous dans ton paquet` : `${owned} / ${items} dans ton paquet`}
      {known > 0 && `, ${known} acquis`}
    </span>
  )
}

export default function Course({ setCounts, onError }: {
  setCounts: (c: Counts) => void
  onError: (m: string) => void
}) {
  const [chapters, setChapters] = useState<Chapter[] | null>(null)
  const [open, setOpen] = useState<number | null>(null)

  const load = () => getCourse().then(setChapters).catch(e => onError(String(e)))

  useEffect(() => { load() }, [])

  if (open !== null) {
    return (
      <Lesson
        id={open}
        setCounts={setCounts}
        onError={onError}
        onDone={() => { setOpen(null); load() }}
      />
    )
  }

  if (!chapters) return <p className="hint">Chargement…</p>

  return (
    <>
      <section className="panel">
        <h2>Le parcours</h2>
        <p className="hint">
          L’ordre suit la grammaire, parce qu’elle est la seule chose réellement séquentielle
          en japonais. <strong>Rien n’est verrouillé</strong> : ouvre la leçon que tu veux,
          et marque comme acquis ce que tu connais déjà.
        </p>
      </section>

      {chapters.map(ch => (
        <section className="panel" key={ch.id}>
          <div className="chap">
            <span className="num mono">{String(ch.pos).padStart(2, '0')}</span>
            <div>
              <h2>{ch.title}</h2>
              <p className="hint">{ch.summary}</p>
              <p className="hint unlock">Débloque : {ch.unlocks}</p>
            </div>
          </div>

          <ol className="lessons">
            {ch.lessons.map(l => (
              <li key={l.id}>
                <button className="lesson" onClick={() => setOpen(l.id)}>
                  <span className="t">
                    {l.title}
                    {l.state === 'done' && <span className="flag done">vue</span>}
                    {l.state === 'known' && <span className="flag known">déjà su</span>}
                  </span>
                  <Cover items={l.items} owned={l.owned} known={l.known} />
                </button>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </>
  )
}
