import type { EstimateReveal } from './public'
import type { Mark } from './score'
import type { Outcome } from './showdown'
import type { Card, Item, ShowdownFormat } from './types'

/** The marks for a Lineup guess, and the items in the right order once the round is over. */
export type LineupMarked = { marks: Mark[]; answer?: Item[] }

/** A Showdown game as the player may see it: the last round played and their next card. */
export type ShowdownView = {
  log: Outcome[]
  last: { you: Card; cpu: Card; stat: string; outcome: Outcome } | null
  next: Card | null
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return (await res.json()) as T
}

/** Every answer is checked on the server, so each of these needs a connection and can reject. */
export const markLineup = (id: string, order: string[], attempt: number) => post<LineupMarked>('lineup', { id, order, attempt })
export const revealEstimate = (id: string, guess: string) => post<EstimateReveal>('ballpark', { id, guess })
export const showdownView = (format: ShowdownFormat, seed: string, picks: string[], played: number) =>
  post<ShowdownView>('showdown', { format, seed, picks, played })
