import { describe, expect, it } from 'vitest'
import { puzzleIndex, dayNumber } from './daily'
import { isSolved, scoreGuess, solution } from './score'
import { shareText } from './share'
import type { Puzzle } from './types'

const p: Puzzle = {
  id: 't',
  prompt: '',
  direction: 'desc',
  items: [
    { label: 'a', value: 10, note: '' },
    { label: 'b', value: 30, note: '' },
    { label: 'c', value: 20, note: '' },
    { label: 'd', value: 20, note: '' },
    { label: 'e', value: 5, note: '' },
  ],
}

describe('score', () => {
  it('sorts desc', () => expect(solution(p).map((i) => i.label)[0]).toBe('b'))
  it('marks a perfect guess solved', () => {
    expect(isSolved(scoreGuess(p, solution(p)))).toBe(true)
  })
  it('treats ties as interchangeable', () => {
    const [b, c, d, a, e] = [1, 2, 3, 0, 4].map((i) => p.items[i])
    expect(isSolved(scoreGuess(p, [b, d, c, a, e]))).toBe(true)
  })
  it('marks rows correct, near (one slot off) or wrong', () => {
    // answer: b30, c20|d20, c20|d20, a10, e5
    expect(scoreGuess(p, p.items)).toEqual(['wrong', 'near', 'correct', 'near', 'correct'])
  })
})

describe('daily', () => {
  it('rolls over at local midnight', () => {
    const a = new Date(2026, 5, 1, 23, 59)
    const b = new Date(2026, 5, 2, 0, 1)
    expect(dayNumber(b) - dayNumber(a)).toBe(1)
  })
  it('wraps the index', () => expect(puzzleIndex(3, new Date(2026, 0, 4))).toBe(0))
})

describe('share', () => {
  it('builds the grid', () => {
    expect(shareText('Lineup Lounge', 0, [['correct', 'near', 'wrong'], ['correct', 'correct', 'correct']], true, 5)).toBe(
      '🏏 Lineup Lounge #1 2/5\n🟩🟨🟥\n🟩🟩🟩',
    )
  })
})
