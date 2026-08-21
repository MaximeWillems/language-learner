import { createEmptyCard, fsrs, generatorParameters, type Card, type Grade, type State } from 'ts-fsrs'

const engine = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }))

type FsrsCard = Card & { learning_steps?: number }

export interface CardRow {
  id: number
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: string | null
}

export function blank(now: Date): FsrsCard {
  return createEmptyCard(now)
}

export function fromRow(row: CardRow): FsrsCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review ? new Date(row.last_review) : undefined
  } as FsrsCard
}

export function apply(card: FsrsCard, rating: Grade, now: Date) {
  return engine.next(card, now, rating)
}

export function previews(card: FsrsCard, now: Date): Record<1 | 2 | 3 | 4, string> {
  const all = engine.repeat(card, now)
  return {
    1: label(all[1].card.due, now),
    2: label(all[2].card.due, now),
    3: label(all[3].card.due, now),
    4: label(all[4].card.due, now)
  }
}

export function label(due: Date, now: Date): string {
  const min = Math.round((due.getTime() - now.getTime()) / 60000)
  if (min < 1) return 'maintenant'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d} j`
  const mo = Math.round(d / 30.4)
  if (mo < 12) return `${mo} mois`
  return `${(d / 365).toFixed(1)} ans`
}
