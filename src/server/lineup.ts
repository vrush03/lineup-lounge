import cricket from '../data/cricket.json'
import type { LineupMarked } from '../lib/api'
import { isSolved, MAX_ATTEMPTS, scoreGuess, solution } from '../lib/score'
import type { Puzzle } from '../lib/types'
import { isObject, isStrings } from './http'

const puzzles = new Map((cricket as Puzzle[]).map((p) => [p.id, p]))

/**
 * Mark one Lineup guess: `order` is the labels top to bottom, `attempt` which try this is (from 1).
 * The values only go back with the guess that ends the round.
 */
export function markLineup(body: unknown, all: Map<string, Puzzle> = puzzles): LineupMarked | null {
  if (!isObject(body)) return null
  const { id, order, attempt } = body
  const puzzle = typeof id === 'string' ? all.get(id) : undefined
  if (!puzzle || !isStrings(order) || !Number.isInteger(attempt)) return null
  if ((attempt as number) < 1 || (attempt as number) > MAX_ATTEMPTS) return null
  const byLabel = new Map(puzzle.items.map((i) => [i.label, i]))
  if (order.length !== puzzle.items.length || new Set(order).size !== order.length || !order.every((l) => byLabel.has(l))) return null
  const marks = scoreGuess(puzzle, order.map((l) => byLabel.get(l)!))
  const over = isSolved(marks) || attempt === MAX_ATTEMPTS
  return over ? { marks, answer: solution(puzzle) } : { marks }
}
