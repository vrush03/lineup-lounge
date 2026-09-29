import type { Item, Puzzle } from './types'

/** correct = right slot, near = one slot away, wrong = further off. */
export type Mark = 'correct' | 'near' | 'wrong'

/** Items in the correct order for a puzzle. */
export function solution(puzzle: Puzzle): Item[] {
  const sign = puzzle.direction === 'asc' ? 1 : -1
  return [...puzzle.items].sort((a, b) => sign * (a.value - b.value))
}

/**
 * Per-row marks for a guess. A row is correct when its value equals the value
 * expected at that position, so tied items are interchangeable.
 */
export function scoreGuess(puzzle: Puzzle, guess: Item[]): Mark[] {
  const answer = solution(puzzle)
  return guess.map((item, i) => {
    if (item.value === answer[i].value) return 'correct'
    const slots = answer.flatMap((a, j) => (a.value === item.value ? [j] : []))
    return slots.some((j) => Math.abs(j - i) === 1) ? 'near' : 'wrong'
  })
}

export function isSolved(marks: Mark[]): boolean {
  return marks.every((m) => m === 'correct')
}
