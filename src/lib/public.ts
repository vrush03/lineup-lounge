import type { EstimateQuestion, Item, Puzzle } from './types'

/**
 * What the browser gets of each dataset. The answers stay on the server (`src/server/`), which
 * hands them out once a round has earned them.
 */

/** A Lineup row before the reveal: who it is, not what they scored. */
export type PublicItem = Omit<Item, 'value' | 'display' | 'note'>
export type PublicPuzzle = Omit<Puzzle, 'items'> & { items: PublicItem[] }

/** What a Ballpark guess unlocks. */
export type EstimateReveal = Pick<EstimateQuestion, 'answer' | 'working' | 'fact' | 'sources'>
export type PublicEstimate = Omit<EstimateQuestion, keyof EstimateReveal>

export function publicPuzzle(p: Puzzle): PublicPuzzle {
  return { ...p, items: p.items.map(({ label, team, country }) => ({ label, team, country })) }
}

export function publicEstimate(q: EstimateQuestion): PublicEstimate {
  const { id, prompt, unit, family, format } = q
  return { id, prompt, unit, family, format }
}

export function estimateReveal(q: EstimateQuestion): EstimateReveal {
  const { answer, working, fact, sources } = q
  return { answer, working, fact, sources }
}
