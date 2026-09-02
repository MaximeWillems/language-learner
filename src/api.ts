import type { Counts, DeckRequest, PracticeRequest, QueueResponse, Rating, ReviewResponse } from '../shared/types'

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
function withFilters(path: string, f: PracticeRequest, limit: number) {
  const p = new URLSearchParams({ limit: String(limit) })
  if (f.scripts.length) p.set('scripts', f.scripts.join(','))
  if (f.groups.length) p.set('groups', f.groups.join(','))
  if (f.kinds.length) p.set('kinds', f.kinds.join(','))
  return call<QueueResponse>(path + '?' + p)
}

export const getQueue = (f: PracticeRequest, limit = 20) => withFilters('/api/queue', f, limit)
export const getPractice = (f: PracticeRequest, limit = 30) => withFilters('/api/practice', f, limit)
export const buildDeck = (body: DeckRequest) => post<Counts>('/api/deck', body)

export const sendReview = (body: { cardId: number; rating: Rating; answer: string | null; correct: boolean }) =>
  post<ReviewResponse>('/api/review', body)

export const logPractice = (body: { cardId: number; answer: string | null; correct: boolean }) =>
  post<{ ok: boolean }>('/api/practice/log', body)

export const saveSettings = (newPerDay: number) => post<Counts>('/api/settings', { newPerDay })

export const getVersion = () => call<{ version: string }>('/api/version')
