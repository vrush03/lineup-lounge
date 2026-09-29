import { describe, expect, it } from 'vitest'
import cricket from '../data/cricket.json'
import { z } from 'zod'
import { puzzleSchema } from './puzzleSchema'
import type { Puzzle } from './types'
import { isSolved, scoreGuess } from './score'
import { hasTeamStyle } from './teams'

const puzzles = z.array(puzzleSchema).parse(cricket) as Puzzle[]

describe('cricket dataset', () => {
  it('has a large, unique set of puzzles', () => {
    expect(puzzles.length).toBeGreaterThan(200)
    expect(new Set(puzzles.map((p) => p.id)).size).toBe(puzzles.length)
  })
  it('keeps puzzles that share a prompt at least 30 days apart in the daily rotation', () => {
    const n = puzzles.length
    const seen = new Map<string, number[]>()
    puzzles.forEach((p, k) => seen.set(p.prompt, [...(seen.get(p.prompt) ?? []), k]))
    for (const days of seen.values())
      for (let i = 0; i < days.length; i++)
        for (let j = i + 1; j < days.length; j++) {
          const d = days[j] - days[i]
          expect(Math.min(d, n - d)).toBeGreaterThanOrEqual(30)
        }
  })
  it('gives every team a colour', () => {
    const missing = new Set(puzzles.flatMap((p) => p.items.map((i) => i.team)).filter((t) => t && !hasTeamStyle(t)))
    expect([...missing]).toEqual([])
  })
  it.each(puzzles.map((p) => [p.id, p] as const))('%s has distinct values and does not start solved', (_, p) => {
    expect(new Set(p.items.map((i) => i.value)).size).toBe(5)
    expect(isSolved(scoreGuess(p, p.items))).toBe(false)
    expect(p.source?.url).toMatch(/^https:\/\//)
  })
})
