export type CardKind = 'reading' | 'recall' | 'meaning'
export type Script = 'hiragana' | 'katakana' | 'kanji'
export type Rating = 1 | 2 | 3 | 4

export interface QueueCard {
  id: number
  kind: CardKind
  glyph: string
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
}

export interface Counts {
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
}
