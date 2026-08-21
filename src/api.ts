import type { Counts, DeckRequest, QueueResponse, Rating, ReviewResponse } from '../shared/types'

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json() as Promise<T>
}

const post = <T,>(url: string, body: unknown) =>
  call<T>(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })

export const getCounts = () => call<Counts>('/api/counts')
export const getQueue = (limit = 20) => call<QueueResponse>(`/api/queue?limit=${limit}`)
export const buildDeck = (body: DeckRequest) => post<Counts>('/api/deck', body)

export const sendReview = (body: { cardId: number; rating: Rating; answer: string | null; correct: boolean }) =>
  post<ReviewResponse>('/api/review', body)
