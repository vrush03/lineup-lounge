import ballpark from '../data/ballpark.json'
import { estimateReveal, type EstimateReveal } from '../lib/public'
import type { EstimateQuestion } from '../lib/types'
import { isObject } from './http'

const questions = new Map((ballpark as EstimateQuestion[]).map((q) => [q.id, q]))

/** The answer to a Ballpark question, in exchange for the player's one guess ('' = a pass). */
export function revealEstimate(body: unknown, all: Map<string, EstimateQuestion> = questions): EstimateReveal | null {
  if (!isObject(body)) return null
  const { id, guess } = body
  const q = typeof id === 'string' ? all.get(id) : undefined
  return q && typeof guess === 'string' ? estimateReveal(q) : null
}
