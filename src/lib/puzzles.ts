import type { Puzzle } from './types'

/**
 * The puzzle set lives in its own chunk so the app shell paints first.
 * It is validated at build time (scripts/data/build.py) and in tests (puzzles.test.ts).
 */
export async function loadPuzzles(): Promise<Puzzle[]> {
  const mod = await import('../data/cricket.json')
  return mod.default as Puzzle[]
}
