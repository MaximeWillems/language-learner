export type CardKind = 'reading' | 'recall' | 'meaning' | 'cloze'
/** Famille de contenu. 'sentence' n'est pas une ecriture, mais se selectionne pareil. */
export type Script = 'hiragana' | 'katakana' | 'kanji' | 'word' | 'sentence'
export type Rating = 1 | 2 | 3 | 4

export interface QueueCard {
  id: number
  kind: CardKind
  text: string
  reading: string
  script: Script
  grp: string
  isNew: boolean
  choices: string[]
  previews: Record<Rating, string>
  meanings: string[]
  meaningLang: string
  onReadings: string[]
  kunReadings: string[]
  strokes: number | null
  translation: string
  words: string[]
  blank: number
  lapses: number
}

export interface DeckSlice {
  script: Script
  kind: CardKind
  n: number
  due: number
  fresh: number
}

/** Seuil FSRS d'echec repete. Anki en utilise 8 ; 6 laisse moins pourrir la carte. */
export const LEECH = 6

export type CardAction = 'suspend' | 'unsuspend' | 'reset'

export interface CardIssue {
  id: number
  kind: CardKind
  script: Script
  text: string
  translation: string
  lapses: number
  reps: number
  suspended: boolean
  due: string
  answered: number
  right: number
}

export interface Review {
  reviewedAt: string
  rating: number
  correct: boolean | null
  answer: string | null
  scheduledDays: number
  mode: string
}

export interface Pending {
  script: Script
  n: number
}

export interface Counts {
  deck: DeckSlice[]
  pending: Pending[]
  hard: number
  suspended: number
  cards: number
  dueNow: number
  newAvailable: number
  newPerDay: number
  newLeftToday: number
  learned: number
  reviewsToday: number
}

export interface QueueResponse {
  cards: QueueCard[]
  counts: Counts
}

export interface PracticeRequest {
  scripts: Script[]
  groups: string[]
  kinds: CardKind[]
}

export interface DeckRequest {
  scripts: Script[]
  groups: string[]
}

export interface ReviewRequest {
  cardId: number
  rating: Rating
  answer: string | null
  correct: boolean
}

export interface ReviewResponse {
  due: string
  interval: string
  previews: Record<Rating, string>
}

export interface DayCount {
  day: string
  n: number
  ok?: number
}

export interface Stats {
  fresh: number
  learning: number
  known: number
  answered: number
  right: number
  streak: number
  past: DayCount[]
  ahead: DayCount[]
}

export interface LessonBrief {
  id: number
  pos: number
  title: string
  state: string | null
  items: number
  owned: number
  known: number
}

export interface Chapter {
  id: number
  pos: number
  title: string
  summary: string
  unlocks: string
  lessons: LessonBrief[]
}

export interface LessonItem {
  role: 'word' | 'example'
  type: 'word' | 'sentence'
  id: number
  text: string
  reading: string
  gloss: string
  owned: boolean
}

export interface Lesson {
  id: number
  title: string
  chapter: string
  body: string
  state: string | null
  items: LessonItem[]
}
